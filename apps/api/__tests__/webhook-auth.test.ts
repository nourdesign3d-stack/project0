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

const verify = vi.fn();
const logInfo = vi.fn();

vi.mock("svix", () => ({
  Webhook: class {
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
    identify: vi.fn(),
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
  env: { CLERK_WEBHOOK_SECRET: "whsec_test" },
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
    verify.mockReset();
    logInfo.mockReset();
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
