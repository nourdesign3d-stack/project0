import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test } from "vitest";

/**
 * Ce que ces tests protègent : **qu'un manifeste ne puisse pas mentir**.
 *
 * Un manifeste faux est pire qu'un document faux : on le regarde dans un
 * tableau de bord, donc on s'y fie. Ce dépôt a la preuve que les textes
 * dérivent — quatorze affirmations fausses en deux jours (D-057), sept règles
 * périmées trouvées par un agent au travail (D-073).
 *
 * D'où deux gardes : chaque package **déclare** son identité, et la route
 * d'exécution ne **révèle jamais** une valeur.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const readJson = (...parts: string[]) =>
  JSON.parse(readFileSync(join(ROOT, ...parts), "utf8"));

describe("manifeste de composant", () => {
  test("chaque package déclare son identité de capacité", () => {
    // Sans déclaration, le manifeste inventerait un identifiant depuis le nom du
    // dossier et n'aurait aucun fournisseur : le tableau de bord afficherait une
    // capacité anonyme, ce qui est pire qu'une absence.
    const packages = readdirSync(join(ROOT, "packages"));
    const manquants: string[] = [];

    for (const name of packages) {
      let manifest: { capability?: { id?: string; criticality?: string } };

      try {
        manifest = readJson("packages", name, "package.json");
      } catch {
        continue;
      }

      if (!(manifest.capability?.id && manifest.capability?.criticality)) {
        manquants.push(name);
      }
    }

    expect(
      manquants,
      "package sans clé `capability` : ajouter id, provider et criticality " +
        "dans son package.json — le manifeste ne les devine pas"
    ).toEqual([]);
  });

  test("le manifeste versionné couvre tous les packages", () => {
    // `pnpm manifest:check` le garantit dans la chaîne ; ce cas le garantit
    // aussi quand seuls les tests tournent.
    const manifest = readJson("manifest.json");
    const packages = readdirSync(join(ROOT, "packages")).filter((name) => {
      try {
        readJson("packages", name, "package.json");

        return true;
      } catch {
        return false;
      }
    });

    expect(manifest.capabilities).toHaveLength(packages.length);
  });

  test("le statut n'est jamais déclaré actif à la main", () => {
    // `active` et `unused` sont **dérivés** des consommateurs réels. Les
    // déclarer permettrait à un package abandonné de se dire actif — ce que
    // `@repo/ai` et `@repo/storage` ont fait pendant des semaines.
    const packages = readdirSync(join(ROOT, "packages"));
    const fautifs: string[] = [];

    for (const name of packages) {
      try {
        const { capability } = readJson("packages", name, "package.json");

        if (capability?.status && capability.status !== "building") {
          fautifs.push(name);
        }
      } catch {
        // Pas un package : rien à vérifier.
      }
    }

    expect(
      fautifs,
      "seul `building` est déclarable — actif et inutilisé se dérivent de " +
        "l'usage réel, sans quoi un package abandonné pourrait se dire actif"
    ).toEqual([]);
  });
});

describe("/manifest — état d'exécution", () => {
  const SECRET = "jeton_de_test";

  const call = async (headers: Record<string, string> = {}) => {
    const { GET } = await import("../app/manifest/route");

    return GET(new Request("http://localhost/manifest", { headers }));
  };

  beforeEach(() => {
    process.env.MANIFEST_TOKEN = SECRET;
  });

  test("refuse sans jeton", async () => {
    // La route dit quels services sont configurés — donc surtout lesquels ne le
    // sont pas. C'est un renseignement utile à un attaquant.
    const response = await call();

    expect(response.status).toBe(401);
  });

  test("refuse de tourner sans jeton configuré", async () => {
    // biome-ignore lint/performance/noDelete: seule façon de retirer une variable d'environnement
    delete process.env.MANIFEST_TOKEN;

    const response = await call({ authorization: "Bearer quelconque" });

    expect(response.status).toBe(503);
  });

  test("ne révèle aucune valeur de configuration", async () => {
    // Le seul contrôle qui compte vraiment ici.
    process.env.STRIPE_SECRET_KEY = "sk_test_valeur_secrete_a_ne_pas_fuiter";

    const response = await call({ authorization: `Bearer ${SECRET}` });
    const corps = await response.text();

    expect(corps).not.toContain("sk_test_valeur_secrete_a_ne_pas_fuiter");
    expect(corps).not.toContain(SECRET);
    // …mais le nom de la variable manquante, lui, sert au diagnostic.
    expect(corps).toContain("STRIPE_WEBHOOK_SECRET");
  });

  test("une variable vide compte comme absente", async () => {
    // Le dépôt le sait déjà : une valeur `\"\"` échoue la validation Zod. Un
    // tableau de bord qui l'afficherait comme branchée mentirait.
    process.env.SVIX_TOKEN = "";

    const response = await call({ authorization: `Bearer ${SECRET}` });
    const { capabilities } = await response.json();
    const webhooks = capabilities.find(
      (capability: { id: string }) => capability.id === "webhooks"
    );

    expect(webhooks.etat).not.toBe("branchee");
    expect(webhooks.manquantes).toContain("SVIX_TOKEN");
  });

  test("ne se laisse pas mettre en cache", async () => {
    const response = await call({ authorization: `Bearer ${SECRET}` });

    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
