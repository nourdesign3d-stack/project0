import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Ce que ces tests protègent : le **refus**, et la discrétion de la réponse.
 * Un webhook de paiement est une frontière publique — seule la signature
 * distingue un appel légitime d'un appel forgé.
 *
 * La signature n'est **pas** simulée : elle est calculée ici selon le schéma
 * publié par Stripe (`HMAC-SHA256` sur `timestamp.corps`), et la route la vérifie
 * réellement avec le SDK. Simuler `constructEvent` aurait produit un test qui ne
 * peut pas échouer ; signer avec le SDK lui-même aurait bouclé la bibliothèque
 * sur elle-même. Ici, la route est confrontée à la spécification.
 *
 * Ce qu'ils ne couvrent pas : l'idempotence (rejeu d'un même événement), qui
 * exige de mémoriser les identifiants traités — donc un modèle de données que la
 * graine n'a pas encore. Voir docs/RISKS.md R-012.
 */

const WEBHOOK_SECRET = "whsec_ZGVzX3Rlc3RzX3VuaXF1ZW1lbnQ";

let requestHeaders: Record<string, string> = {};
let configured = true;

const capture = vi.fn();
const logError = vi.fn();
const getUserList = vi.fn();
const createEvent = vi.fn();
const deleteEvent = vi.fn();

const duplicate = () => Object.assign(new Error("unique"), { code: "P2002" });

// La mémoire d'idempotence est simulée, mais la **logique** qui l'utilise ne
// l'est pas : `lib/idempotency.ts` est chargé pour de vrai.
vi.mock("@repo/database", () => ({
  database: {
    webhookEvent: {
      create: (...args: unknown[]) => createEvent(...args),
      delete: (...args: unknown[]) => deleteEvent(...args),
    },
  },
}));

// `@repo/payments` n'est **pas** simulé : la route utilise le vrai client Stripe,
// donc la vraie vérification de signature. Seule la clé est factice — le SDK ne
// la valide pas à la construction et aucun appel réseau n'a lieu ici.
process.env.STRIPE_SECRET_KEY = "sk_test_pour_les_tests";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers(requestHeaders)),
}));

vi.mock("@repo/analytics/server", () => ({
  analytics: {
    capture: (...args: unknown[]) => capture(...args),
    shutdown: vi.fn(),
  },
}));

vi.mock("@repo/auth/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      users: { getUserList: (...args: unknown[]) => getUserList(...args) },
    }),
}));

vi.mock("@repo/observability/log", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => logError(...args),
  },
}));

vi.mock("@repo/observability/error", () => ({
  parseError: (error: unknown) => String((error as Error).message),
}));

vi.mock("@/env", () => ({
  get env() {
    return { STRIPE_WEBHOOK_SECRET: configured ? WEBHOOK_SECRET : undefined };
  },
}));

/**
 * Schéma publié par Stripe : `t=<horodatage>,v1=<HMAC-SHA256(t.corps, secret)>`.
 * L'horodatage doit rester dans la fenêtre de tolérance du SDK.
 */
const sign = (payload: string) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
};

const post = async (body: string, headers: Record<string, string>) => {
  requestHeaders = headers;

  const { POST } = await import("../app/webhooks/payments/route");

  return POST(
    new Request("http://localhost/webhooks/payments", { method: "POST", body })
  );
};

const event = (type: string, object: Record<string, unknown>) =>
  JSON.stringify({
    id: "evt_1",
    object: "event",
    type,
    data: { object },
  });

describe("webhook Stripe", () => {
  beforeEach(() => {
    vi.resetModules();
    configured = true;
    capture.mockReset();
    logError.mockReset();
    getUserList.mockReset();
    getUserList.mockResolvedValue({ data: [], totalCount: 0 });
    createEvent.mockReset();
    createEvent.mockResolvedValue(undefined);
    deleteEvent.mockReset();
    deleteEvent.mockResolvedValue(undefined);
  });

  test("refuse une requête sans en-tête de signature", async () => {
    const response = await post(event("checkout.session.completed", {}), {});

    expect(response.status).toBe(400);
  });

  test("refuse une signature forgée", async () => {
    const body = event("checkout.session.completed", { customer: "cus_1" });

    const response = await post(body, {
      "stripe-signature": "t=1,v1=0000000000000000000000000000000000000000",
    });

    expect(response.status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
  });

  test("refuse un corps modifié après signature", async () => {
    const signed = event("checkout.session.completed", { customer: "cus_1" });
    const tampered = event("checkout.session.completed", { customer: "cus_2" });

    const response = await post(tampered, {
      "stripe-signature": sign(signed),
    });

    expect(response.status).toBe(400);
  });

  test("un refus de signature n'est pas une erreur serveur", async () => {
    // 5xx déclenche les réessais de Stripe : une signature invalide ne doit
    // jamais provoquer de rejeu, elle ne deviendra jamais valide.
    const response = await post(event("checkout.session.completed", {}), {
      "stripe-signature": "t=1,v1=deadbeef",
    });

    expect(response.status).toBeLessThan(500);
  });

  test("accepte un événement réellement signé", async () => {
    const body = event("checkout.session.completed", { customer: "cus_1" });

    const response = await post(body, { "stripe-signature": sign(body) });

    expect(response.status).toBe(200);
  });

  test("ne renvoie pas l'événement dans la réponse", async () => {
    // La réponse d'un webhook part vers un tiers : elle n'a aucune raison de
    // contenir l'identité du client, le montant ou l'adresse e-mail.
    const body = event("checkout.session.completed", {
      customer: "cus_secret",
      customer_details: { email: "client@exemple.test" },
      amount_total: 4200,
    });

    const response = await post(body, { "stripe-signature": sign(body) });
    const text = await response.text();

    expect(text).not.toContain("cus_secret");
    expect(text).not.toContain("client@exemple.test");
    expect(text).not.toContain("4200");
  });

  test("vérifie la signature sur le corps brut, non re-sérialisé", async () => {
    // Corps non canonique : espaces et ordre des clés préservés. Une
    // re-sérialisation invaliderait la signature.
    const raw =
      '{ "id" : "evt_2" , "type" : "checkout.session.completed" , "data" : { "object" : { "customer" : "cus_1" } } }';

    const response = await post(raw, { "stripe-signature": sign(raw) });

    expect(response.status).toBe(200);
  });

  test("signale une absence de configuration au lieu de l'acquitter", async () => {
    // Un 2xx dit à Stripe « reçu, traité ». Sans clé, rien n'est traité :
    // l'événement serait perdu sans laisser de trace côté fournisseur.
    configured = false;

    const body = event("checkout.session.completed", {});
    const response = await post(body, { "stripe-signature": "t=1,v1=x" });

    expect(response.status).toBeGreaterThanOrEqual(500);
  });

  test("réserve l'événement avant de le traiter", async () => {
    const body = event("checkout.session.completed", { customer: "cus_1" });

    await post(body, { "stripe-signature": sign(body) });

    expect(createEvent).toHaveBeenCalledWith({
      data: { provider: "stripe", eventId: "evt_1" },
    });
  });

  test("ne retraite pas un événement déjà reçu", async () => {
    // Stripe rejoue dès qu'il doute de la livraison. Un paiement retraité a des
    // conséquences réelles.
    createEvent.mockRejectedValue(duplicate());

    const body = event("checkout.session.completed", { customer: "cus_1" });
    const response = await post(body, { "stripe-signature": sign(body) });

    expect(response.status).toBe(200);
    expect(getUserList).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  test("libère la réservation quand le traitement échoue", async () => {
    // Sans libération, le réessai serait pris pour un doublon et l'événement
    // perdu en silence — l'inverse du but recherché.
    getUserList.mockRejectedValue(new Error("Clerk injoignable"));

    const body = event("checkout.session.completed", { customer: "cus_1" });
    const response = await post(body, { "stripe-signature": sign(body) });

    expect(response.status).toBe(500);
    expect(deleteEvent).toHaveBeenCalledWith({
      where: { provider_eventId: { provider: "stripe", eventId: "evt_1" } },
    });
  });

  test("refuse de traiter si la mémoire d'idempotence est indisponible", async () => {
    // Une base injoignable n'est pas un doublon. Traiter quand même reviendrait
    // à renoncer à l'idempotence en silence.
    createEvent.mockRejectedValue(new Error("base injoignable"));

    const body = event("checkout.session.completed", { customer: "cus_1" });
    const response = await post(body, { "stripe-signature": sign(body) });

    expect(response.status).toBe(503);
    expect(capture).not.toHaveBeenCalled();
  });

  test("parcourt toutes les pages d'utilisateurs pour retrouver le client", async () => {
    // `getUserList` est paginé. Ne lire que la première page fait échouer le
    // rapprochement en silence dès que le compte dépasse une page.
    const target = {
      id: "user_cible",
      privateMetadata: { stripeCustomerId: "cus_1" },
    };

    getUserList
      .mockResolvedValueOnce({
        data: [{ id: "user_autre", privateMetadata: {} }],
        totalCount: 2,
      })
      .mockResolvedValueOnce({ data: [target], totalCount: 2 });

    const body = event("checkout.session.completed", { customer: "cus_1" });

    await post(body, { "stripe-signature": sign(body) });

    expect(getUserList).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: "user_cible" })
    );
  });
});
