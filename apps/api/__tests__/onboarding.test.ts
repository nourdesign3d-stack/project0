import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Le premier geste prescrit au repreneur doit fonctionner.
 *
 * ⚠️ Il ne fonctionnait pas. Le bloc « Démarrer » du README prescrivait
 * `cp apps/app/.env.example apps/app/.env.local` — alors que **le README lui-même**
 * expliquait deux lignes plus bas qu'une variable optionnelle laissée à `""`
 * échoue la validation Zod. Il omettait aussi la génération du client Prisma, que
 * `pnpm install` ne déclenche pas.
 *
 * Mesuré le 2026-08-07 sur un clone vierge : `pnpm install` puis
 * `pnpm --filter app run typecheck` produit quatre erreurs, dont
 * `Cannot find module './generated/client'`. Après `pnpm --filter @repo/database
 * run build`, le typecheck est propre. Relevé en audit (D-042).
 *
 * Ce test ne rejoue pas l'installation — trop lente pour la chaîne courante. Il
 * garde ce qui a été prouvé une fois : que les deux étapes restent prescrites, et
 * que la recette cassée ne revienne pas.
 *
 * Il vit dans `apps/api` faute d'exécuteur de tests à la racine — même raison que
 * `e2e-artifacts.test.ts` et `observability-keys.test.ts`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const README = readFileSync(join(ROOT, "README.md"), "utf8");

/** Copie d'un `.env.example` : la recette qui recopie les valeurs vides `""`. */
const COPIES_EXAMPLE = /cp\s+\S*\.env\.example/;

/** Génération du client Prisma, sous l'une ou l'autre de ses formes. */
const GENERATES_CLIENT = /@repo\/database.*build|prisma generate/;

/** Premier bloc de commandes d'une section Markdown. */
const BASH_FENCE = /```bash\n([\s\S]*?)```/;

/** Le bloc de commandes qui suit le titre « Démarrer ». */
const onboarding = (() => {
  const section = README.split("## Démarrer")[1] ?? "";

  return section.match(BASH_FENCE)?.[1] ?? "";
})();

describe("parcours d'arrivée", () => {
  test("le bloc « Démarrer » existe et n'est pas vide", () => {
    // Sans cela, un changement de titre rendrait tous les cas suivants verts
    // sans rien avoir examiné.
    expect(onboarding.trim().length).toBeGreaterThan(0);
  });

  test("il prescrit env:setup, et non une copie des .env.example", () => {
    expect(onboarding).toContain("pnpm env:setup");

    // `cp …env.example …env.local` recopie les valeurs vides `""` telles quelles :
    // la validation Zod échoue et l'application ne démarre pas.
    expect(
      COPIES_EXAMPLE.test(onboarding),
      "le bloc prescrit une copie de .env.example : les valeurs vides feront " +
        "échouer la validation Zod — utiliser pnpm env:setup"
    ).toBe(false);
  });

  test("il prescrit la génération du client Prisma", () => {
    // `pnpm install` ne la déclenche pas : le script `prepare` n'installe que
    // les hooks git. Sans elle, `Cannot find module './generated/client'`.
    expect(
      GENERATES_CLIENT.test(onboarding),
      "le bloc n'engendre pas le client Prisma : un clone neuf échouera au " +
        "premier typecheck ou build"
    ).toBe(true);
  });
});
