import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Ce que ce test protège : la **borne** de la mémoire d'idempotence, et la
 * distinction entre ce qui peut être effacé et ce qui doit être vu.
 *
 * `WebhookEvent` ne croissait que — une ligne par livraison, jamais supprimée.
 * Rien ne l'aurait signalé : c'est le genre de dette qui ne se manifeste qu'en
 * production, tard, sous la forme d'une latence inexpliquée. Relevé en audit le
 * 2026-08-07 (D-049).
 */

const deleteMany = vi.fn();
const count = vi.fn();
const logWarn = vi.fn();
const logError = vi.fn();

vi.mock("@repo/database", () => ({
  database: {
    webhookEvent: {
      deleteMany: (...args: unknown[]) => deleteMany(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: {
    info: vi.fn(),
    warn: (...args: unknown[]) => logWarn(...args),
    error: (...args: unknown[]) => logError(...args),
  },
}));

vi.mock("@repo/observability/error", () => ({
  parseError: (error: unknown) => String((error as Error).message),
}));

const SECRET = "cron_secret_de_test";

const call = async (headers: Record<string, string> = {}) => {
  const { GET } = await import("../app/cron/purge-webhook-events/route");

  return GET(
    new Request("http://localhost/cron/purge-webhook-events", { headers })
  );
};

describe("purge des événements de webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = SECRET;
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
    count.mockReset();
    count.mockResolvedValue(0);
    logWarn.mockReset();
    logError.mockReset();
  });

  test("refuse un appel sans jeton", async () => {
    // La route est publiquement joignable : le refus est la seule protection.
    const response = await call();

    expect(response.status).toBe(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("refuse un jeton incorrect", async () => {
    const response = await call({ authorization: "Bearer faux" });

    expect(response.status).toBe(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("refuse de tourner sans secret configuré", async () => {
    // Sans secret, n'importe qui déclencherait une suppression de masse.
    // `delete` et non `= undefined` : ce dernier pose la chaîne "undefined",
    // qui est vraie et servirait donc de secret.
    // biome-ignore lint/performance/noDelete: seule façon de retirer une variable d'environnement
    delete process.env.CRON_SECRET;

    const response = await call({ authorization: "Bearer quelconque" });

    expect(response.status).toBe(503);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("ne supprime que les lignes terminées et anciennes", async () => {
    // Une réservation jamais aboutie est une anomalie : la supprimer effacerait
    // la trace du seul incident qui mérite d'être vu.
    await call({ authorization: `Bearer ${SECRET}` });

    const [{ where }] = deleteMany.mock.calls[0] as [
      { where: { completedAt: Record<string, unknown> } },
    ];

    expect(
      where.completedAt.not,
      "la purge effacerait des réservations non terminées"
    ).not.toBeUndefined();
    expect(where.completedAt.lt).toBeInstanceOf(Date);
  });

  test("signale les réservations anciennes jamais terminées", async () => {
    // Sans ce signal, une accumulation resterait invisible : les lignes ne sont
    // pas supprimées, donc rien ne varie dans les compteurs de la purge.
    count.mockResolvedValue(3);

    await call({ authorization: `Bearer ${SECRET}` });

    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining("3"));
  });

  test("ne se tait pas quand la purge échoue", async () => {
    // Une purge muette qui échoue chaque nuit laisse la table croître
    // exactement comme si elle n'existait pas.
    deleteMany.mockRejectedValue(new Error("base injoignable"));

    const response = await call({ authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(503);
    expect(logError).toHaveBeenCalled();
  });
});
