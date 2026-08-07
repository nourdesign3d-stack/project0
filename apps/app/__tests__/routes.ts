import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Inventaire des routes de `apps/app`, partagé par deux contrôles de nature
 * différente — et c'est volontaire :
 *
 * - `__tests__/route-protection.test.ts` vérifie qu'un contrôle d'autorisation
 *   **existe**. Statique, sans serveur, il tourne toujours (`pnpm test`).
 * - `e2e/tests/route-protection.spec.ts` vérifie qu'une requête anonyme est
 *   **réellement refusée**. Il attrape ce que le premier ne peut pas voir : un
 *   `auth()` dont on ignore le résultat. Mais il exige une application démarrée.
 *
 * Le second couvre strictement plus que le premier ; le premier est le plancher
 * qui subsiste quand aucun service tiers n'est configuré. Voir R-013.
 *
 * L'inventaire est ici pour qu'il n'existe qu'**une** liste de routes publiques :
 * deux listes divergeraient, et la divergence passerait inaperçue.
 */

// Le dossier est fourni par l'appelant plutôt que déduit d'`import.meta` : ce
// module est chargé par deux exécuteurs différents (vitest depuis `apps/app`,
// Playwright depuis la racine), et `import.meta` n'est pas disponible dans les
// deux — l'import échouait silencieusement côté Playwright.

/**
 * Fichiers que Next traite comme un point d'entrée.
 *
 * ⚠️ L'inventaire ne connaissait que `page.tsx` et `route.ts`. Or Next accepte
 * les mêmes noms avec **cinq extensions** et reconnaît aussi `default`
 * (interception de routes parallèles). Un `route.tsx` ou un `page.ts` — noms
 * parfaitement valides, qu'un éditeur crée sans qu'on y pense — n'était donc
 * **pas inventorié**, et échappait au contrôle sans que rien ne le signale.
 * Relevé en audit le 2026-08-07 (D-044).
 *
 * Le défaut est plus grave qu'il n'y paraît : ce test est le plancher de R-013,
 * le seul contrôle qui tourne sans serveur. Une route hors inventaire n'est pas
 * « mal testée », elle n'est pas testée du tout.
 */
const ROUTE_FILE = /^(page|route|default)\.(js|jsx|ts|tsx|mjs)$/;

/**
 * Une server action est un point d'entrée HTTP à part entière : Next l'expose
 * par un `POST` avec un identifiant d'action, sans passer par un `route.ts`.
 * Elle doit donc porter son propre contrôle, exactement comme une route.
 *
 * Le fichier est retenu dès qu'il porte la directive `"use server"` en tête —
 * seule forme qui déclare un module d'actions.
 */
const USE_SERVER = /^\s*["']use server["']/;
const SOURCE_FILE = /\.(js|jsx|ts|tsx|mjs)$/;

/**
 * Routes joignables sans session. Chaque entrée est une décision de sécurité.
 *
 * - `(unauthenticated)/**` : l'authentification elle-même. Sans elle, boucle.
 * - `.well-known/vercel/flags` : découverte des feature flags, interrogée sans
 *   session par la barre d'outils Vercel et protégée par son propre secret
 *   (`FLAGS_SECRET`, vérifié dans `@repo/feature-flags/access`).
 */
export const PUBLIC_ROUTES = [
  join("(unauthenticated)", "sign-in", "[[...sign-in]]", "page.tsx"),
  join("(unauthenticated)", "sign-up", "[[...sign-up]]", "page.tsx"),
  join(".well-known", "vercel", "flags", "route.ts"),
];

const isServerActions = (path: string): boolean => {
  if (!SOURCE_FILE.test(path)) {
    return false;
  }

  try {
    return USE_SERVER.test(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
};

const collect = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collect(path);
    }

    return ROUTE_FILE.test(entry.name) || isServerActions(path) ? [path] : [];
  });
};

/** Chemins de fichiers relatifs à `app/`, par exemple `(authenticated)/page.tsx`. */
export const collectRoutes = (appDir: string): string[] =>
  collect(appDir).map((path) => relative(appDir, path));

export const isDynamic = (route: string): boolean =>
  route.split(sep).some((segment) => segment.startsWith("["));

/**
 * Une server action n'a **pas d'URL** : Next l'appelle par un `POST` sur la page
 * qui l'importe, avec un identifiant d'action. Elle doit porter un contrôle
 * d'autorisation — le contrôle statique la couvre — mais il n'y a rien à
 * interroger côté Playwright. Sans cette distinction, `actions/users/get.ts`
 * produisait l'URL `/actions/users`, qui n'existe pas : le `404` reçu figurait
 * parmi les statuts de refus acceptés et le test passait **sans avoir touché
 * quoi que ce soit**.
 */
export const isServerAction = (route: string): boolean =>
  !ROUTE_FILE.test(route.split(sep).at(-1) ?? "");

/**
 * Chemin de fichier → chemin d'URL, selon les conventions du routeur Next :
 * les groupes `(nom)` disparaissent, le nom de fichier tombe.
 *
 * Renvoie `null` pour une route **dynamique**. La version précédente en retirait
 * simplement les segments `[id]` : `(authenticated)/items/[id]/page.tsx`
 * devenait `/items`, une URL qui n'existe pas. Playwright recevait un `404`,
 * que la liste des refus acceptait — le test passait au vert **sans avoir
 * jamais touché la route**. Sur une application multi-tenant, la ressource
 * identifiée par un paramètre est précisément celle qu'il faut contrôler.
 *
 * Aucune valeur ne peut être devinée : l'appelant doit en fournir une, ou
 * déclarer la route comme non couverte. Voir D-033.
 */
export const toUrlPath = (route: string): string | null => {
  if (isDynamic(route) || isServerAction(route)) {
    return null;
  }

  const segments = route
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith("("));

  return `/${segments.join("/")}`;
};
