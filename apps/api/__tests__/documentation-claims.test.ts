import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Ce que ce test protège : la **cohérence entre ce que le dépôt affirme et ce
 * qu'il fait**.
 *
 * C'est le défaut dominant de ce dépôt, relevé par deux audits successifs : un
 * texte annonce une protection, et personne ne vérifie que le code la sert.
 * Onze affirmations documentaires étaient devenues fausses au 2026-08-07, dont
 * trois portaient sur des contrôles de sécurité (T-2002).
 *
 * Corriger les onze ne suffit pas : elles redeviendront fausses. Les trois qui
 * peuvent être **vérifiées mécaniquement** le sont ici. Les autres relèvent du
 * jugement et restent à la charge de la revue — le dire est plus honnête que
 * prétendre tout couvrir.
 *
 * Il vit dans `apps/api` faute d'exécuteur de tests à la racine — même raison
 * que `e2e-artifacts.test.ts` et `onboarding.test.ts`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

/** Fichier de spec Playwright dédié au parcours à identifiants (D-037). */
const CREDENTIALS_SPEC = "authenticated-journey.spec.ts";

describe("affirmations vérifiables de la documentation", () => {
  test("les fichiers de spec cités par la CI existent vraiment", () => {
    // La CI citait `access-control.spec.ts` comme portant le parcours à
    // identifiants, alors que D-037 l'avait déplacé. Une référence périmée dans
    // un commentaire de sécurité envoie le prochain lecteur au mauvais endroit.
    const workflow = read(".github", "workflows", "ci.yml");
    const specs = new Set(readdirSync(join(ROOT, "e2e", "tests")));

    const cited = workflow.match(/e2e\/tests\/([\w-]+\.spec\.ts)/g) ?? [];

    for (const reference of cited) {
      const name = reference.split("/").pop() as string;

      expect(
        specs.has(name),
        `ci.yml cite ${name}, qui n'existe pas dans e2e/tests/`
      ).toBe(true);
    }

    // Et le fichier qui manipule des identifiants doit bien être celui-là.
    expect(specs.has(CREDENTIALS_SPEC)).toBe(true);
  });

  test("les trois apps appliquent bien les en-têtes de sécurité", () => {
    // `SECURITY_MODEL.md` affirme « appliqué par le proxy des trois apps ».
    // L'affirmation était fausse pour deux d'entre elles jusqu'au 2026-08-06
    // (D-034), et rien ne l'aurait signalé : la suite e2e ne démarre qu'une
    // application (R-026).
    for (const app of ["app", "web", "api"]) {
      const proxy = read("apps", app, "proxy.ts");

      expect(
        proxy.includes("securityMiddleware"),
        `apps/${app}/proxy.ts n'applique pas securityMiddleware, alors que ` +
          "SECURITY_MODEL.md affirme que les trois apps le font"
      ).toBe(true);
    }
  });

  test("chaque modèle Prisma figure au dictionnaire de données", () => {
    // Un modèle absent du dictionnaire est un modèle dont personne n'a décidé
    // s'il portait une donnée sensible.
    const schema = read("packages", "database", "prisma", "schema.prisma");
    const dictionary = read("docs", "DATA_DICTIONARY.md");

    const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
      ([, name]) => name
    );

    expect(
      models.length,
      "aucun modèle trouvé : le chemin a-t-il changé ?"
    ).toBeGreaterThan(0);

    for (const model of models) {
      expect(
        dictionary.includes(model),
        `le modèle ${model} n'apparaît pas dans docs/DATA_DICTIONARY.md`
      ).toBe(true);
    }
  });
});
