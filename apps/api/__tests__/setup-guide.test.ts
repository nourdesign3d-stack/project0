import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Ce que ce test protège : **qu'aucune variable ne soit oubliée du guide**.
 *
 * `docs/SETUP.md` répond à « quelle clé faut-il, et quand ». Un guide de
 * configuration qui oublie une variable est pire qu'absent : on croit avoir tout
 * renseigné, et le service correspondant reste inactif sans que rien ne le dise
 * — c'est exactement ce qui est arrivé à BetterStack, dont les variables de
 * journalisation n'existaient pas dans le dépôt (D-028).
 *
 * Le contrôle est **structurel** : il compare l'inventaire réel des
 * `.env.example` au contenu du guide. Ajouter une variable sans la documenter
 * fait rougir la chaîne.
 *
 * Il vit dans `apps/api` faute d'exécuteur de tests à la racine — même raison
 * que `documentation-claims.test.ts` et `onboarding.test.ts`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Nom de variable en tête de ligne, commentée ou non. */
const DECLARATION = /^#?\s*([A-Z][A-Z0-9_]*)=/gm;

const exampleFiles = (): string[] => {
  const found: string[] = [join(ROOT, ".env.example")];

  for (const group of ["apps", "packages"]) {
    const base = join(ROOT, group);

    for (const entry of readdirSync(base)) {
      const candidate = join(base, entry, ".env.example");

      try {
        readFileSync(candidate);
        found.push(candidate);
      } catch {
        // Ce workspace n'a pas de variables : rien à documenter.
      }
    }
  }

  return found;
};

const declared = new Set<string>();

for (const file of exampleFiles()) {
  const content = readFileSync(file, "utf8");

  for (const [, name] of content.matchAll(DECLARATION)) {
    declared.add(name);
  }
}

const guide = readFileSync(join(ROOT, "docs", "SETUP.md"), "utf8");

describe("guide d'initialisation", () => {
  test("l'inventaire des variables n'est pas vide", () => {
    // Sans cela, un chemin erroné rendrait le test suivant vert sans rien lire.
    expect(declared.size).toBeGreaterThan(20);
  });

  for (const name of [...declared].sort()) {
    test(`${name} est documentée`, () => {
      expect(
        guide.includes(name),
        `${name} est déclarée dans un .env.example mais absente de docs/SETUP.md : ` +
          "celui qui configure le projet ne saura pas à quoi elle sert"
      ).toBe(true);
    });
  }
});
