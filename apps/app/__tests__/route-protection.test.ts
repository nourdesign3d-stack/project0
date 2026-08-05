import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/**
 * R-013 : `apps/app/proxy.ts` ne fait que du routage. Il n'appelle pas
 * `auth.protect()`, et ce n'est pas un oubli — Clerk 7 déprécie la protection
 * par correspondance de chemins, au motif qu'elle « peut diverger du routage
 * réel de Next.js et laisser des ressources protégées joignables ». Mesuré le
 * 2026-08-05 : une route posée hors du groupe `(authenticated)` répondait 200 à
 * un appel anonyme, `userId: null`.
 *
 * L'autorisation se vérifie donc au plus près de la donnée
 * (`.claude/rules/security.md`). Reste à rendre l'oubli **détectable** : c'est
 * l'objet de ce test. Il échoue dès qu'une route est ajoutée sans contrôle et
 * sans être déclarée publique — le contraire d'un test qui rassure.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "app");

const ROUTE_FILES = new Set(["page.tsx", "route.ts"]);
const LAYOUT_FILE = "layout.tsx";

/**
 * Un contrôle d'autorisation, c'est interroger la session côté serveur.
 * Volontairement large : mieux vaut accepter un contrôle exotique que se
 * prétendre exhaustif sur une liste de motifs.
 */
const AUTHORIZATION_CHECK = /\bauth\s*\(|\bcurrentUser\s*\(|auth\.protect\s*\(/;

/**
 * Routes joignables sans session. Chaque entrée est une décision de sécurité.
 *
 * - `(unauthenticated)/**` : l'authentification elle-même. Sans elle, boucle.
 * - `.well-known/vercel/flags` : découverte des feature flags, interrogée sans
 *   session par la barre d'outils Vercel et protégée par son propre secret
 *   (`FLAGS_SECRET`, vérifié dans `@repo/feature-flags/access`).
 */
const PUBLIC_ROUTES = [
  join("(unauthenticated)", "sign-in", "[[...sign-in]]", "page.tsx"),
  join("(unauthenticated)", "sign-up", "[[...sign-up]]", "page.tsx"),
  join(".well-known", "vercel", "flags", "route.ts"),
];

const collectRoutes = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectRoutes(path);
    }

    return ROUTE_FILES.has(entry.name) ? [path] : [];
  });
};

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

const routes = collectRoutes(APP_DIR).map((path) => relative(APP_DIR, path));

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
