import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Garde-fou contre une configuration **absente et invisible**.
 *
 * Mesuré le 2026-08-05 : la graine déclarait `BETTERSTACK_API_KEY` et
 * `BETTERSTACK_URL` — légitimes, mais destinées au produit **Uptime**
 * (`status/index.tsx`). Les journaux, eux, passent par `@logtail/next`, qui ne
 * lit que `BETTER_STACK_SOURCE_TOKEN` et `BETTER_STACK_INGESTING_URL`
 * (`dist/platform/generic.js`). Aucune des deux n'existait dans le dépôt, et le
 * SDK se rabat **silencieusement** sur un affichage console : rien ne partait,
 * et rien ne le signalait. Constaté au collecteur local — zéro requête sans
 * elles, une avec (D-028).
 *
 * Ce test ne vérifie pas le comportement du SDK : il vérifie que les quatre
 * variables sont déclarées, et que les deux familles ne se confondent pas.
 * C'est là que la faute s'était logée.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Produit Uptime — lues par `packages/observability/status/index.tsx`. */
const UPTIME = ["BETTERSTACK_API_KEY", "BETTERSTACK_URL"];

/** Produit Telemetry — noms imposés par `@logtail/next` 0.3.1. */
const LOGS = ["BETTER_STACK_SOURCE_TOKEN", "BETTER_STACK_INGESTING_URL"];

const SOURCES = [
  join("apps", "api", ".env.example"),
  join("apps", "app", ".env.example"),
  join("apps", "web", ".env.example"),
  join("packages", "observability", "keys.ts"),
];

const read = (source: string) => readFileSync(join(ROOT, source), "utf8");

describe("variables BetterStack", () => {
  for (const source of SOURCES) {
    test(`${source} déclare les variables de journalisation`, () => {
      const content = read(source);

      for (const name of LOGS) {
        expect(
          content,
          `${name} absent — sans lui, @logtail/next n'envoie rien et ne le dit pas`
        ).toContain(name);
      }
    });

    test(`${source} conserve les variables du produit Uptime`, () => {
      // Elles ne servent pas aux journaux, mais elles servent : les retirer
      // casserait l'indicateur de statut du pied de page public.
      const content = read(source);

      for (const name of UPTIME) {
        expect(content, `${name} absent`).toContain(name);
      }
    });
  }
});
