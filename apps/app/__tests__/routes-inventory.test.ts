import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { collectRoutes, isServerAction, toUrlPath } from "./routes";

/**
 * Ce que ce test protège : **la portée de l'inventaire**, dont dépendent les deux
 * contrôles de R-013.
 *
 * ⚠️ L'inventaire ne connaissait que `page.tsx` et `route.ts`. Or Next accepte les
 * mêmes noms avec cinq extensions et reconnaît aussi `default`. Un `route.tsx` ou
 * un `page.ts` — noms parfaitement valides — n'était donc pas inventorié, et
 * échappait au contrôle **sans que rien ne le signale**. Les server actions, qui
 * sont des points d'entrée HTTP à part entière, n'y figuraient pas davantage.
 * Relevé en audit le 2026-08-07 (D-044).
 *
 * Une route hors inventaire n'est pas « mal testée » : elle n'est pas testée.
 * C'est pourquoi ce contrôle porte sur l'énumération elle-même, et non sur son
 * résultat au moment où il est écrit.
 *
 * Les sondes vivent dans un dossier temporaire : poser de vrais fichiers dans
 * `app/` créerait des routes réelles.
 */

const fixture = mkdtempSync(join(tmpdir(), "inventaire-routes-"));

const probe = (
  relativePath: string,
  content = "export default () => null;"
) => {
  const path = join(fixture, relativePath);

  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);

  return relativePath;
};

// Les trois formes que l'inventaire ignorait, plus deux témoins déjà couverts.
const cases = [
  probe(join("classique", "page.tsx")),
  probe(join("classique", "route.ts")),
  probe(join("extension", "route.tsx")),
  probe(join("extension", "page.ts")),
  probe(join("parallele", "default.tsx")),
  probe(
    join("actions", "utilisateurs.ts"),
    '"use server";\nexport const a = 1;'
  ),
];

// Ce qui ne doit **pas** être pris pour un point d'entrée.
probe(join("classique", "layout.tsx"));
probe(join("classique", "composant.tsx"));
probe(join("classique", "notes.md"), "# pas du code");

const found = collectRoutes(fixture);

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe("inventaire des routes", () => {
  test("la sonde n'est pas vide", () => {
    // Sans cela, un chemin erroné rendrait les cas suivants verts sans rien lire.
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const entry of cases) {
    test(`${entry} est inventorié`, () => {
      expect(
        found,
        `${entry} est un point d'entrée que Next sert, et il échappe au contrôle`
      ).toContain(entry);
    });
  }

  test("un layout ou un composant n'est pas un point d'entrée", () => {
    expect(found).not.toContain(join("classique", "layout.tsx"));
    expect(found).not.toContain(join("classique", "composant.tsx"));
    expect(found).not.toContain(join("classique", "notes.md"));
  });

  test("une server action n'est pas interrogeable par URL", () => {
    // Elle n'a pas d'URL : Next l'appelle par un POST sur la page qui l'importe.
    // Lui en fabriquer une produisait un 404, accepté comme un refus.
    const action = join("actions", "utilisateurs.ts");

    expect(isServerAction(action)).toBe(true);
    expect(toUrlPath(action)).toBeNull();
  });

  test("une route ordinaire garde son URL", () => {
    expect(toUrlPath(join("classique", "page.tsx"))).toBe("/classique");
  });
});
