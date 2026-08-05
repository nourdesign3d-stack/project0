import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { collectRoutes, PUBLIC_ROUTES } from "./routes";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "app");

/**
 * R-013 : `apps/app/proxy.ts` ne fait que du routage. Il n'appelle pas
 * `auth.protect()`, et ce n'est pas un oubli — Clerk 7 déprécie la protection
 * par correspondance de chemins, au motif qu'elle « peut diverger du routage
 * réel de Next.js et laisser des ressources protégées joignables ». Mesuré le
 * 2026-08-05 : une route posée hors du groupe `(authenticated)` répondait 200 à
 * un appel anonyme, `userId: null`.
 *
 * Ce test est le **plancher** : il constate qu'un contrôle existe, sans serveur,
 * et tourne donc toujours. Il ne peut pas juger si le contrôle refuse
 * réellement — un `auth()` dont on ignore le résultat le satisfait. C'est
 * l'objet de `e2e/tests/route-protection.spec.ts`, qui interroge l'application
 * en marche.
 */

const LAYOUT_FILE = "layout.tsx";

/**
 * Un contrôle d'autorisation, c'est interroger la session côté serveur.
 * Volontairement large : mieux vaut accepter un contrôle exotique que se
 * prétendre exhaustif sur une liste de motifs.
 */
const AUTHORIZATION_CHECK = /\bauth\s*\(|\bcurrentUser\s*\(|auth\.protect\s*\(/;

const readIfPresent = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

/** Le contrôle peut vivre dans la route, ou dans n'importe quel layout parent. */
const isProtected = (routePath: string): boolean => {
  if (AUTHORIZATION_CHECK.test(readIfPresent(routePath))) {
    return true;
  }

  let directory = dirname(routePath);

  while (directory.startsWith(APP_DIR)) {
    if (AUTHORIZATION_CHECK.test(readIfPresent(join(directory, LAYOUT_FILE)))) {
      return true;
    }

    directory = dirname(directory);
  }

  return false;
};

const routes = collectRoutes(APP_DIR);

test("toute route est protégée ou explicitement déclarée publique", () => {
  const unguarded = routes.filter(
    (route) =>
      !(
        PUBLIC_ROUTES.includes(route) ||
        isProtected(join(APP_DIR, ...route.split(sep)))
      )
  );

  expect(
    unguarded,
    "route sans contrôle d'autorisation et absente de PUBLIC_ROUTES — " +
      "ajouter le contrôle, ou déclarer la route publique en le justifiant"
  ).toEqual([]);
});

test("aucune route publique déclarée n'a disparu", () => {
  // Une entrée périmée fait croire qu'une exception est encore examinée.
  const stale = PUBLIC_ROUTES.filter((route) => !routes.includes(route));

  expect(stale, "entrée obsolète dans PUBLIC_ROUTES").toEqual([]);
});

test("le jeu de routes analysé n'est pas vide", () => {
  // Sans cela, une erreur de chemin rendrait les deux tests ci-dessus verts
  // en n'analysant rien du tout.
  expect(routes.length).toBeGreaterThan(0);
});
