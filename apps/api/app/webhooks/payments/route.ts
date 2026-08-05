import { analytics } from "@repo/analytics/server";
import { clerkClient } from "@repo/auth/server";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import type { Stripe } from "@repo/payments";
import { stripe } from "@repo/payments";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env";

const USER_PAGE_SIZE = 100;
// Borne explicite : au-delà, le rapprochement par balayage n'est plus tenable.
const MAX_USER_PAGES = 50;

/**
 * ⚠️ Rapprochement par **balayage** : Clerk ne sait pas filtrer sur
 * `privateMetadata`. Coût linéaire en nombre d'utilisateurs, à chaque événement.
 *
 * La bonne approche, le jour où le produit créera vraiment des clients Stripe :
 * inscrire l'identifiant Clerk dans les `metadata` du client Stripe à sa
 * création, et le lire depuis l'événement — aucun balayage. Elle n'est pas
 * implémentable ici : rien dans la graine ne crée de client Stripe. Voir R-020.
 *
 * `getUserList` est **paginé**. La version précédente n'en lisait que la
 * première page et échouait donc en silence dès que le compte la dépassait.
 */
const getUserFromCustomerId = async (customerId: string) => {
  const clerk = await clerkClient();
  let offset = 0;

  for (let page = 0; page < MAX_USER_PAGES; page += 1) {
    const { data, totalCount } = await clerk.users.getUserList({
      limit: USER_PAGE_SIZE,
      offset,
    });

    const user = data.find(
      (currentUser) =>
        currentUser.privateMetadata.stripeCustomerId === customerId
    );

    if (user) {
      return user;
    }

    offset += data.length;

    if (data.length === 0 || offset >= totalCount) {
      return undefined;
    }
  }

  // Silence interdit : sans cette trace, un rapprochement abandonné passerait
  // pour un client simplement introuvable.
  log.warn(
    `webhook Stripe : rapprochement abandonné après ${MAX_USER_PAGES} pages`
  );

  return undefined;
};

const handleCheckoutSessionCompleted = async (
  data: Stripe.Checkout.Session
) => {
  if (!data.customer) {
    return;
  }

  const customerId =
    typeof data.customer === "string" ? data.customer : data.customer.id;
  const user = await getUserFromCustomerId(customerId);

  if (!user) {
    return;
  }

  analytics?.capture({
    event: "User Subscribed",
    distinctId: user.id,
  });
};

const handleSubscriptionScheduleCanceled = async (
  data: Stripe.SubscriptionSchedule
) => {
  if (!data.customer) {
    return;
  }

  const customerId =
    typeof data.customer === "string" ? data.customer : data.customer.id;
  const user = await getUserFromCustomerId(customerId);

  if (!user) {
    return;
  }

  analytics?.capture({
    event: "User Unsubscribed",
    distinctId: user.id,
  });
};

export const POST = async (request: Request): Promise<Response> => {
  // 503 et non 2xx : un 2xx dit à Stripe « reçu et traité ». Sans clé, rien
  // n'est traité — l'événement serait perdu sans trace chez le fournisseur.
  if (!(stripe && env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // Corps brut : une re-sérialisation invaliderait la signature.
  const body = await request.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    // 4xx et non 5xx : Stripe réessaie sur 5xx, or une signature invalide ne
    // deviendra jamais valide. Journaliser la forme, jamais le corps reçu.
    log.error(`webhook Stripe : signature refusée — ${parseError(error)}`);

    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      }
      case "subscription_schedule.canceled": {
        await handleSubscriptionScheduleCanceled(event.data.object);
        break;
      }
      default: {
        log.warn(`webhook Stripe : type non traité — ${event.type}`);
      }
    }

    await analytics?.shutdown();

    // Réponse minimale : elle part vers un tiers. La version précédente y
    // renvoyait l'événement entier — identité du client, montant, adresse.
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error(
      `webhook Stripe : traitement de ${event.type} en échec — ${parseError(error)}`
    );

    return NextResponse.json({ ok: false }, { status: 500 });
  }
};
