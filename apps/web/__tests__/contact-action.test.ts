import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Ce que ces tests protègent : **ce qui sort vers le navigateur**, et **ce qui
 * sert de clé** à la limitation de débit. Le formulaire de contact est la seule
 * frontière publique non authentifiée de `apps/web`.
 *
 * Deux défauts relevés en audit le 2026-08-07 (D-054), tous deux dans ce fichier :
 *
 *  - la clé de limitation venait de `x-forwarded-for` **tel quel** — fourni par
 *    le client, donc changeable à chaque requête ;
 *  - toute erreur serveur repartait au navigateur via `parseError`.
 *
 * ⚠️ Ce fichier est le **premier test de `apps/web`** : l'application n'en avait
 * aucun (T-1401), donc aucune de ses protections n'était gardée.
 */

/** Marqueurs de configuration qui ne doivent jamais atteindre le navigateur. */
const MENTIONS_CONFIG = /config/i;
const MENTIONS_PROVIDER = /resend/i;

let forwardedFor: string | null = null;
let rateLimited = false;
let emailConfigured = true;

const limit = vi.fn();
const send = vi.fn();
const logError = vi.fn();
const captured = vi.fn();

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers(forwardedFor ? { "x-forwarded-for": forwardedFor } : {})
    ),
}));

vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: () => ({
    limit: (...args: unknown[]) => {
      limit(...args);

      return Promise.resolve({ success: !rateLimited });
    },
  }),
  slidingWindow: () => ({}),
}));

vi.mock("@repo/email", () => ({
  get resend() {
    return emailConfigured
      ? { emails: { send: (...a: unknown[]) => send(...a) } }
      : null;
  },
}));

vi.mock("@repo/email/templates/contact", () => ({
  ContactTemplate: () => null,
}));

vi.mock("@repo/observability/error", () => ({
  parseError: (error: unknown) => {
    captured(error);

    return String((error as Error).message);
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: {
    error: (...args: unknown[]) => logError(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/env", () => ({
  get env() {
    return {
      UPSTASH_REDIS_REST_URL: "https://upstash.test",
      UPSTASH_REDIS_REST_TOKEN: "jeton",
      RESEND_FROM: emailConfigured ? "contact@exemple.test" : undefined,
    };
  },
}));

const submit = async () => {
  const { contact } = await import("../app/[locale]/contact/actions/contact");

  return contact("Prénom", "visiteur@exemple.test", "Bonjour.");
};

describe("formulaire de contact", () => {
  beforeEach(() => {
    vi.resetModules();
    forwardedFor = "203.0.113.7";
    rateLimited = false;
    emailConfigured = true;
    limit.mockReset();
    send.mockReset();
    send.mockResolvedValue({});
    logError.mockReset();
    captured.mockReset();
  });

  test("n'emploie que la première adresse de la liste comme clé", async () => {
    // `x-forwarded-for` est une liste. Employer la chaîne entière laissait
    // changer de seau en ajoutant un saut : `1.2.3.4, 9.9.9.9` est une autre clé
    // que `1.2.3.4`.
    forwardedFor = "203.0.113.7, 198.51.100.4, 10.0.0.1";

    await submit();

    expect(limit).toHaveBeenCalledWith("contact_form_203.0.113.7");
  });

  test("refuse une requête sans adresse plutôt que de partager un seau", async () => {
    // Sans en-tête, la clé devenait `contact_form_null` : un seau partagé par
    // tous, où le premier visiteur consommait le quota de tout le monde.
    forwardedFor = null;

    const result = await submit();

    expect(result.error).toBeDefined();
    expect(limit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("ne révèle pas l'état de configuration du serveur", async () => {
    // « Email is not configured. » renseignait un visiteur anonyme sur la
    // configuration. L'information est utile — côté serveur.
    emailConfigured = false;

    const result = await submit();

    expect(result.error).not.toMatch(MENTIONS_CONFIG);
    expect(result.error).not.toMatch(MENTIONS_PROVIDER);
    expect(logError).toHaveBeenCalled();
  });

  test("ne renvoie pas le message d'erreur du fournisseur", async () => {
    // Une erreur de Resend partait telle quelle : nom d'hôte, identifiant de
    // compte, détail du refus.
    send.mockRejectedValue(
      new Error("Resend: domain exemple.test not verified")
    );

    const result = await submit();

    expect(result.error).not.toContain("Resend");
    expect(result.error).not.toContain("exemple.test");
    // …mais l'incident, lui, est bien remonté.
    expect(captured).toHaveBeenCalled();
  });

  test("une entrée invalide ne devient pas un incident", async () => {
    // Un refus de validation est attendu. En faire un événement Sentry offrirait
    // à tout visiteur le moyen de saturer le canal (D-052, R-003).
    const { contact } = await import("../app/[locale]/contact/actions/contact");

    const result = await contact("", "pas-un-email", "");

    expect(result.error).toBeDefined();
    expect(captured).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("un envoi légitime passe", async () => {
    // Sans ce cas, tous les précédents seraient satisfaits par une action qui
    // refuse tout.
    const result = await submit();

    expect(result.error).toBeUndefined();
    expect(send).toHaveBeenCalled();
  });
});
