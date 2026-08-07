import { analytics } from "@repo/analytics/server";
import { clerkClient } from "@repo/auth/server";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import type { Stripe } from "@repo/payments";
import { stripe } from "@repo/payments";
// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { claimEvent, completeEvent, releaseEvent } from "@/lib/idempotency";

const PROVIDER = "stripe";

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

  // ⚠️ L'en-tête est contrôlé **avant** de lire le corps. L'ordre inverse
  // mettait en mémoire la totalité de la charge utile d'un appelant anonyme
  // avant de découvrir qu'il n'avait produit aucune signature — le vecteur
  // d'épuisement mémoire le moins coûteux du dépôt, sur une route publique sans
  // pare-feu ni limitation de débit (R-003). Le webhook Clerk faisait déjà
  // l'inverse. Relevé en audit le 2026-08-06 (D-039).
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Corps brut : une re-sérialisation invaliderait la signature.
  const body = await request.text();

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
    //
    // `expected` : un refus de signature n'est pas un incident. Le remonter à
    // Sentry offrait à tout appelant anonyme le moyen de noyer les vraies
    // erreurs sous du bruit qu'il contrôle (D-052).
    log.error(
      `webhook Stripe : signature refusée — ${parseError(error, { expected: true })}`
    );

    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Réserver avant de traiter : Stripe rejoue un événement dès qu'il doute de
  // sa livraison, et un paiement retraité a des conséquences réelles (R-012).
  let claimed: boolean;

  try {
    claimed = await claimEvent(PROVIDER, event.id);
  } catch (error) {
    // Sans mémoire, l'idempotence n'est plus garantie : mieux vaut échouer et
    // laisser Stripe réessayer que traiter à l'aveugle.
    log.error(`webhook Stripe : réservation impossible — ${parseError(error)}`);

    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // Identifiant de corrélation : l'identifiant d'événement du fournisseur est
  // posé sur la trace Sentry. Sentry est bridé — ni corps, ni en-têtes, ni
  // variables locales (R-018) — et sans ce point commun, un incident vu dans
  // Sentry ne peut être rapproché ni du journal ni de l'événement chez Stripe.
  // C'est la compensation que `.claude/rules/security.md` exige de chaque
  // frontière serveur, et qu'aucune n'appliquait (D-052).
  Sentry.setTag("webhook.provider", PROVIDER);
  Sentry.setTag("webhook.event_id", event.id);

  if (!claimed) {
    log.info(`webhook Stripe : événement déjà traité — ${event.id}`);

    return NextResponse.json({ ok: true, duplicate: true });
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

    // Marquer **abouti**. Sans cela, la réservation reste indistinguable d'un
    // traitement interrompu et sera reprise après le délai de péremption : le
    // même événement serait traité deux fois (D-049).
    await completeEvent(PROVIDER, event.id);

    // ⚠️ **Après** avoir marqué l'événement abouti, jamais avant.
    //
    // `shutdown()` attend que l'analytique ait vidé sa file — jusqu'à trente
    // secondes, vers un service **optionnel**. Placé avant, il pouvait empêcher
    // `completeEvent` de s'exécuter : la réservation restait inachevée, la
    // reprise la reprenait quinze minutes plus tard, et **l'événement était
    // traité deux fois**. Sur un webhook de paiement, cela signifie un
    // traitement financier dupliqué — provoqué par un service qui n'est même pas
    // requis. Relevé en réaudit le 2026-08-07 (D-064).
    await analytics?.shutdown();

    // Réponse minimale : elle part vers un tiers. La version précédente y
    // renvoyait l'événement entier — identité du client, montant, adresse.
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Libérer, sinon le réessai de Stripe serait pris pour un doublon et
    // l'événement serait perdu en silence.
    await releaseEvent(PROVIDER, event.id);

    log.error(
      `webhook Stripe : traitement de ${event.type} en échec — ${parseError(error)}`
    );

    return NextResponse.json({ ok: false }, { status: 500 });
  }
};
