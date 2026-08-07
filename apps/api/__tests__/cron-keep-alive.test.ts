import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La route importe @repo/database ; on neutralise l'accès réel à Postgres.
//
// ⚠️ La sonde portait sur `database.page.count()`. Or `Page` est le modèle de
// **démonstration** que `DOMAIN_MODEL.md` prescrit de supprimer : le jour où
// quelqu'un suit cette consigne, la tâche planifiée cesse de compiler et la base
// retombe en veille, sans qu'aucun document ne relie les deux. La route
// interroge désormais `SELECT 1`, qui ne suppose rien du contenu de la base
// (D-050).
// Le test porte sur le contrôle d'accès, pas sur la base.
const query = vi.fn().mockResolvedValue([{ 1: 1 }]);

vi.mock("@repo/database", () => ({
  database: { $queryRaw: (...args: unknown[]) => query(...args) },
}));

const call = async (headers: Record<string, string> = {}) => {
  const { GET } = await import("../app/cron/keep-alive/route");
  return GET(new Request("http://localhost/cron/keep-alive", { headers }));
};

describe("cron keep-alive", () => {
  const previous = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    query.mockClear();
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
    expect(query).not.toHaveBeenCalled();
  });

  test("refuse un appel sans en-tête d'autorisation", async () => {
    process.env.CRON_SECRET = "secret-de-test";

    const response = await call();

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  test("refuse un secret incorrect", async () => {
    process.env.CRON_SECRET = "secret-de-test";

    const response = await call({ authorization: "Bearer mauvais" });

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  test("accepte le secret attendu et ne fait qu'une lecture", async () => {
    process.env.CRON_SECRET = "secret-de-test";

    const response = await call({ authorization: "Bearer secret-de-test" });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("n'interroge aucun modèle du schéma", async () => {
    // Le contrôle porte sur la **forme** de la requête : tout ce qui nomme une
    // table lie la tâche planifiée au modèle métier, et `DOMAIN_MODEL.md`
    // prescrit justement de supprimer le modèle de démonstration (D-050).
    process.env.CRON_SECRET = "secret-de-test";

    await call({ authorization: "Bearer secret-de-test" });

    const [template] = query.mock.calls[0] as [TemplateStringsArray];

    expect(template.join("").trim()).toBe("SELECT 1");
  });
});
