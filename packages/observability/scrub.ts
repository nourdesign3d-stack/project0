/**
 * Retire d'un événement Sentry tout ce qui provient de la requête.
 *
 * Mesuré le 2026-08-05 sur un collecteur local : la graine ne filtrait que les
 * **événements d'erreur** (`beforeSend`). Les **transactions** — émises à chaque
 * requête, `tracesSampleRate` à 1, qu'il y ait erreur ou non — emportaient
 * l'en-tête `authorization`, le cookie de session et le corps complet. Le
 * runtime edge, lui, n'avait aucun filtre du tout.
 *
 * D'où un filtre unique, appliqué aux deux canaux et aux trois runtimes : un
 * garde-fou qui ne couvre qu'une sortie sur trois donne une fausse assurance,
 * ce qui est pire que pas de garde-fou du tout. Voir D-026, R-010, R-018.
 */

interface RequestBearing {
  request?: Record<string, unknown>;
}

/**
 * Profondeur maximale explorée. Les cycles sont traités par `seen` ; cette borne
 * ne protège que d'un objet pathologiquement profond.
 */
const MAX_DEPTH = 64;

const WHITESPACE_GROUPS = /(\s+)/;
const HAS_SCHEME = /^https?:\/\//i;

/**
 * Un mot ressemble-t-il à une URL porteuse de paramètres ?
 *
 * ⚠️ La version précédente testait la chaîne **entière** avec une expression
 * ancrée (`/^(?:https?:\/\/|\/)[^\s]*\?/`). Elle ne voyait donc une URL que si
 * celle-ci commençait la chaîne. Un audit externe a montré le trou le
 * 2026-08-06 : `"fetch failed: https://api/reset?token=SECRET"` sortait
 * **intact**, et c'est le cas le plus courant — un message d'erreur de `fetch`
 * embarque l'URL appelée. Idem pour `exception.values[].value`, le champ où un
 * jeton a le plus de chances d'atterrir. Voir D-035.
 *
 * On raisonne désormais **mot par mot** : un mot est suspect s'il contient un
 * `?` et ressemble à une adresse — schéma explicite, ou simple présence d'un
 * `/`, ce qui couvre `api.exemple.com/v1/x?cle=…` sans schéma.
 */
const isUrlLike = (word: string): boolean =>
  word.includes("?") && (HAS_SCHEME.test(word) || word.includes("/"));

/**
 * Coupe la chaîne de requête de chaque mot qui en porte une, en conservant tout
 * le reste du texte — ponctuation et espacement compris.
 *
 * Le chemin est gardé : sans lui, un événement ne sert plus à rien, et un filtre
 * qui rend le diagnostic impossible finit contourné.
 *
 * Effet de bord assumé : un mot très long contenant à la fois `/` et `?` — du
 * JSON sérialisé sans espaces, par exemple — sera tronqué à son premier `?`.
 * On perd du contexte plutôt que de laisser fuir un jeton.
 */
const withoutQuery = (value: string): string =>
  value
    .split(WHITESPACE_GROUPS)
    .map((word) => (isUrlLike(word) ? word.slice(0, word.indexOf("?")) : word))
    .join("");

const stripQueryStrings = (
  node: unknown,
  seen: WeakSet<object>,
  depth = 0
): void => {
  if (depth > MAX_DEPTH || !(node && typeof node === "object")) {
    return;
  }

  // Un événement Sentry peut contenir des références circulaires : sans cette
  // mémoire, la profondeur maximale servait de seule protection, et tout ce qui
  // se trouvait au-delà ressortait intact.
  if (seen.has(node)) {
    return;
  }

  seen.add(node);

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string") {
      (node as Record<string, unknown>)[key] = withoutQuery(value);
    } else {
      stripQueryStrings(value, seen, depth + 1);
    }
  }
};

/**
 * Générique et non typé sur la forme exacte d'un événement Sentry : le SDK en
 * expose plusieurs (erreur, transaction), et l'appelant conserve son type.
 */
export const scrubRequest = <T>(event: T): T => {
  const { request } = event as RequestBearing;

  if (request) {
    request.cookies = undefined;
    request.data = undefined;
    request.headers = undefined;
    request.query_string = undefined;
  }

  stripQueryStrings(event, new WeakSet());

  return event;
};
