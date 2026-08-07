import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Ce que ces tests protègent : le **refus**. Un webhook est une frontière
 * publique — seule la signature distingue un appel légitime d'un appel forgé.
 *
 * Ce qu'ils ne couvrent pas : l'idempotence (rejeu d'un même événement). Elle
 * exige de mémoriser les identifiants traités, donc un modèle de données que la
 * graine n'a pas encore. Voir docs/RISKS.md R-012.
 */

let requestHeaders: Record<string, string> = {};
let configured = true;
let malformedSecret = false;

const verify = vi.fn();
const logInfo = vi.fn();
const identify = vi.fn();
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

vi.mock("svix", () => ({
  Webhook: class {
    constructor() {
      if (malformedSecret) {
        throw new Error("Invalid secret");
      }
    }

    verify(...args: unknown[]) {
      return verify(...args);
    }
  },
}));

// `headers()` de Next exige un contexte de requête, absent en test unitaire.
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers(requestHeaders)),
}));

// Ces modules importent `server-only`, qui lève hors contexte serveur.
vi.mock("@repo/analytics/server", () => ({
  analytics: {
    identify: (...args: unknown[]) => identify(...args),
    capture: vi.fn(),
    groupIdentify: vi.fn(),
    shutdown: vi.fn(),
  },
}));

vi.mock("@repo/auth/server", () => ({}));

vi.mock("@repo/observability/log", () => ({
  log: {
    info: (...args: unknown[]) => logInfo(...args),
    error: vi.fn(),
  },
}));

vi.mock("@/env", () => ({
  get env() {
    return { CLERK_WEBHOOK_SECRET: configured ? "whsec_test" : undefined };
  },
}));

const SIGNED_HEADERS = {
  "svix-id": "msg_1",
  "svix-timestamp": "1",
  "svix-signature": "v1,signature",
};

const post = async (body: string, headers: Record<string, string>) => {
  requestHeaders = headers;

  const { POST } = await import("../app/webhooks/auth/route");

  return POST(
    new Request("http://localhost/webhooks/auth", { method: "POST", body })
  );
};

describe("webhook Clerk", () => {
  beforeEach(() => {
    vi.resetModules();
    configured = true;
    malformedSecret = false;
    verify.mockReset();
    logInfo.mockReset();
    identify.mockReset();
    createEvent.mockReset();
    createEvent.mockResolvedValue(undefined);
    deleteEvent.mockReset();
    deleteEvent.mockResolvedValue(undefined);
  });

  test("ne transmet aucun identifiant direct à l'outil d'analytique", async () => {
    // Ces attributs partaient à chaque création et mise à jour d'utilisateur,
    // vers un sous-traitant, sans chemin de retour : supprimer un compte pose un
    // marqueur et n'efface rien chez le destinataire (D-043).
    const user = {
      id: "user_1",
      created_at: 1_700_000_000_000,
      email_addresses: [{ email_address: "personne@exemple.test" }],
      first_name: "Prénom",
      last_name: "Nom",
      phone_numbers: [{ phone_number: "+33600000000" }],
      image_url: "https://img.clerk.test/personne.jpg",
    };

    verify.mockReturnValue({ type: "user.created", data: user });

    await post("{}", SIGNED_HEADERS);

    const transmitted = JSON.stringify(identify.mock.calls);

    for (const value of [
      "personne@exemple.test",
      "Prénom",
      "Nom",
      "+33600000000",
      "personne.jpg",
    ]) {
      expect(
        transmitted.includes(value),
        `« ${value} » est transmis à l'outil d'analytique`
      ).toBe(false);
    }

    // …mais le rattachement pseudonyme, lui, doit continuer de fonctionner.
    expect(transmitted).toContain("user_1");
  });

  test("transmet les mêmes attributs à la mise à jour qu'à la création", async () => {
    // Les deux gestionnaires portaient le même bloc dupliqué : corriger l'un et
    // oublier l'autre laisserait la fuite ouverte sur le chemin le plus fréquent.
    const user = {
      id: "user_2",
      created_at: 1_700_000_000_000,
      email_addresses: [{ email_address: "autre@exemple.test" }],
      first_name: "Autre",
      last_name: "Personne",
      phone_numbers: [{ phone_number: "+33611111111" }],
      image_url: "https://img.clerk.test/autre.jpg",
    };

    verify.mockReturnValue({ type: "user.updated", data: user });

    await post("{}", SIGNED_HEADERS);

    const transmitted = JSON.stringify(identify.mock.calls);

    expect(transmitted).not.toContain("autre@exemple.test");
    expect(transmitted).not.toContain("+33611111111");
    expect(transmitted).toContain("user_2");
  });

  test("un secret mal formé ne provoque pas de boucle de réessais", async () => {
    // `new Webhook(secret)` lève sur une valeur tronquée ou sans préfixe.
    // L'exception remontait non capturée : Next répondait 500, Clerk réessayait,
    // et chaque réessai reproduisait le même 500. Une faute de frappe dans une
    // variable d'environnement suffisait (D-046).
    malformedSecret = true;

    const response = await post('{"type":"user.created"}', SIGNED_HEADERS);

    expect(
      response.status,
      "un 5xx déclenche les réessais de Clerk, or un secret mal formé ne " +
        "deviendra pas valide en réessayant"
    ).toBeLessThan(500);
  });

  test("refuse une requête sans en-têtes Svix", async () => {
    const response = await post("{}", {});

    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  test("refuse une signature invalide", async () => {
    verify.mockImplementation(() => {
      throw new Error("signature invalide");
    });

    const response = await post('{"type":"user.created"}', SIGNED_HEADERS);

    expect(response.status).toBe(400);
  });

  test("vérifie la signature sur le corps brut, non re-sérialisé", async () => {
    // Corps volontairement non canonique : espaces et ordre des clés préservés.
    const raw =
      '{ "type" : "session.created" ,  "data" : { "id" : "sess_1" } }';
    // Type non traité par le switch : le test porte sur la vérification, pas sur
    // le traitement métier de l'événement.
    verify.mockReturnValue({ type: "session.created", data: { id: "sess_1" } });

    await post(raw, SIGNED_HEADERS);

    expect(verify).toHaveBeenCalledWith(raw, expect.anything());
  });

  test("réserve la livraison, pas la ressource", async () => {
    // La clé est `svix-id`, identifiant de **livraison** : Svix conserve le même
    // d'un réessai à l'autre. L'identifiant de la ressource est partagé par tous
    // les événements qui la concernent — l'utiliser confondrait une création et
    // une mise à jour du même utilisateur.
    verify.mockReturnValue({ type: "user.created", data: { id: "user_1" } });

    await post('{"type":"user.created"}', SIGNED_HEADERS);

    expect(createEvent).toHaveBeenCalledWith({
      data: { provider: "clerk", eventId: "msg_1" },
    });
  });

  test("ne retraite pas une livraison déjà reçue", async () => {
    createEvent.mockRejectedValue(duplicate());
    verify.mockReturnValue({ type: "user.created", data: { id: "user_1" } });

    const response = await post('{"type":"user.created"}', SIGNED_HEADERS);

    expect(response.status).toBe(200);
  });

  test("refuse de traiter si la mémoire d'idempotence est indisponible", async () => {
    createEvent.mockRejectedValue(new Error("base injoignable"));
    verify.mockReturnValue({ type: "user.created", data: { id: "user_1" } });

    const response = await post('{"type":"user.created"}', SIGNED_HEADERS);

    expect(response.status).toBe(503);
  });

  test("signale une absence de configuration au lieu de l'acquitter", async () => {
    configured = false;

    const response = await post('{"type":"user.created"}', SIGNED_HEADERS);

    expect(response.status).toBe(503);
  });

  test("ne journalise jamais le corps de l'événement", async () => {
    verify.mockReturnValue({
      type: "session.created",
      data: { id: "sess_1", email_addresses: [{ email_address: "a@b.c" }] },
    });

    await post(
      '{"data":{"email_addresses":[{"email_address":"a@b.c"}]}}',
      SIGNED_HEADERS
    );

    const journal = JSON.stringify(logInfo.mock.calls);

    expect(journal).not.toContain("a@b.c");
    expect(journal).not.toContain("email_addresses");
  });
});
