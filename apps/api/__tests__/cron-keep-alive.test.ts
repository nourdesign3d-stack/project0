import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La route importe @repo/database ; on neutralise l'accès réel à Postgres.
// Le test porte sur le contrôle d'accès, pas sur la base.
const count = vi.fn().mockResolvedValue(0);

vi.mock("@repo/database", () => ({
  database: { page: { count: () => count() } },
}));

const call = async (headers: Record<string, string> = {}) => {
  const { GET } = await import("../app/cron/keep-alive/route");
  return GET(new Request("http://localhost/cron/keep-alive", { headers }));
};

describe("cron keep-alive", () => {
  const previous = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    count.mockClear();
  });

  afterEach(() => {
    process.env.CRON_SECRET = previous;
  });

  test("refuse quand le secret n'est pas configuré", async () => {
    // `process.env.X = undefined` écrirait la chaîne "undefined" : pour simuler
    // une variable absente, il faut retirer la clé.
    // biome-ignore lint/performance/noDelete: seule façon de retirer une variable d'environnement
    delete process.env.CRON_SECRET;

    const response = await call({ authorization: "Bearer whatever" });

    expect(response.status).toBe(503);
    expect(count).not.toHaveBeenCalled();
  });

  test("refuse un appel sans en-tête d'autorisation", async () => {
    process.env.CRON_SECRET = "secret-de-test";

    const response = await call();

    expect(response.status).toBe(401);
    expect(count).not.toHaveBeenCalled();
  });

  test("refuse un secret incorrect", async () => {
    process.env.CRON_SECRET = "secret-de-test";

    const response = await call({ authorization: "Bearer mauvais" });

    expect(response.status).toBe(401);
    expect(count).not.toHaveBeenCalled();
  });

  test("accepte le secret attendu et ne fait qu'une lecture", async () => {
    process.env.CRON_SECRET = "secret-de-test";

    const response = await call({ authorization: "Bearer secret-de-test" });

    expect(response.status).toBe(200);
    expect(count).toHaveBeenCalledTimes(1);
  });
});
