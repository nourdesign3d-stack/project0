import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Garde-fou contre une fuite par artefact.
 *
 * Une trace Playwright enregistre les en-têtes **et les corps** des requêtes.
 * Un parcours qui se connecte y laisse donc le mot de passe du compte de test et
 * le cookie de session. Ces artefacts sont téléversés par la CI, et **GitHub ne
 * caviarde jamais le contenu d'un artefact** — il ne masque que les journaux.
 * Relevé en audit le 2026-08-06 (D-037).
 *
 * Le commentaire de `ci.yml` disait « ne jamais y laisser de secret ». Une
 * convention ne tient pas : celui qui ajoutera le prochain parcours authentifié
 * ne la lira pas. Ce test la rend exécutoire.
 *
 * Il vit dans `apps/api` faute d'exécuteur de tests à la racine — même raison
 * que `observability-keys.test.ts`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SPECS = join(ROOT, "e2e", "tests");

/** Marqueurs d'un parcours qui manipule des identifiants. */
const CREDENTIALS = ["E2E_USER_PASSWORD", "E2E_USER_OTP"];

/** Les trois artefacts qui peuvent transporter une valeur saisie ou reçue. */
const DISABLED = ['trace: "off"', 'video: "off"', 'screenshot: "off"'];

const specs = readdirSync(SPECS).filter((name) => name.endsWith(".spec.ts"));

describe("artefacts Playwright", () => {
  test("l'inventaire des specs n'est pas vide", () => {
    // Sans cela, une erreur de chemin rendrait le test suivant vert sans rien
    // avoir examiné.
    expect(specs.length).toBeGreaterThan(0);
  });

  for (const spec of specs) {
    test(`${spec} ne conserve pas d'artefact s'il manipule des identifiants`, () => {
      const content = readFileSync(join(SPECS, spec), "utf8");

      if (!CREDENTIALS.some((marker) => content.includes(marker))) {
        return;
      }

      for (const directive of DISABLED) {
        expect(
          content,
          `${spec} lit des identifiants sans désactiver les artefacts : ` +
            `ajouter test.use({ ${DISABLED.join(", ")} }) au bloc concerné`
        ).toContain(directive);
      }
    });
  }
});
