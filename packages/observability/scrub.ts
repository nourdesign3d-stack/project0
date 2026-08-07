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
 * Un mot ressemble-t-il à une adresse ?
 *
 * ⚠️ Deux élargissements successifs, chacun après une mesure :
 *
 * 1. La version d'origine testait la chaîne **entière** avec une expression
 *    ancrée : elle ne voyait une URL que si celle-ci commençait la chaîne.
 *    `"fetch failed: https://api/reset?token=SECRET"` sortait intact — et c'est
 *    le cas le plus courant, un message d'erreur de `fetch` embarquant l'URL
 *    appelée. Corrigé le 2026-08-06 en raisonnant **mot par mot** (D-035).
 *
 * 2. Ce raisonnement par mot n'a jamais regardé que la chaîne de requête. Or un
 *    secret voyage dans une URL par **trois** emplacements, pas un seul :
 *    `?cle=…`, le **fragment** `#access_token=…` — la forme qu'emploient les
 *    redirections OAuth implicites — et la partie *userinfo* `https://user:motdepasse@hôte/`.
 *    Les deux derniers passaient. Relevé en audit le 2026-08-07 (D-045).
 *
 * Un mot est donc suspect dès qu'il ressemble à une adresse — schéma explicite,
 * ou simple présence d'un `/`, ce qui couvre `api.exemple.com/v1/x?cle=…` sans
 * schéma — **et** qu'il porte l'un de ces trois emplacements.
 */
const CREDENTIALS_IN_URL = /^([a-z][\w+.-]*:\/\/)[^/@\s]*@/i;

const looksLikeAddress = (word: string): boolean =>
  HAS_SCHEME.test(word) || word.includes("/");

const isUrlLike = (word: string): boolean =>
  looksLikeAddress(word) && (word.includes("?") || word.includes("#"));

/**
 * Coupe tout ce qui suit le chemin — chaîne de requête **et** fragment — et
 * retire la partie *userinfo* d'une adresse qui en porte une.
 *
 * Le chemin est gardé : sans lui, un événement ne sert plus à rien, et un filtre
 * qui rend le diagnostic impossible finit contourné.
 *
 * Effets de bord assumés, et c'est le bon sens du compromis : un mot très long
 * contenant `/` et `?` — du JSON sérialisé sans espaces — sera tronqué à son
 * premier séparateur, et un `#` légitime dans une adresse (ancre de document)
 * disparaît aussi. On perd du contexte plutôt que de laisser fuir un jeton.
 *
 * **Deux formes restent hors de portée**, et il faut le dire plutôt que le taire :
 * un secret placé dans un **segment de chemin** (`/reset/SECRET`) est
 * indiscernable d'un identifiant de ressource, et un secret dans un mot sans
 * `/` ni schéma n'est pas une adresse. Ce filtre borne les URL, il ne remplace
 * pas la règle « ne jamais journaliser de valeur sensible ».
 */
const cut = (word: string): string => {
  const separators = [word.indexOf("?"), word.indexOf("#")].filter(
    (index) => index !== -1
  );

  return separators.length > 0 ? word.slice(0, Math.min(...separators)) : word;
};

const withoutCredentials = (word: string): string =>
  word.replace(CREDENTIALS_IN_URL, "$1");

const withoutQuery = (value: string): string =>
  value
    .split(WHITESPACE_GROUPS)
    .map((word) => {
      if (isUrlLike(word)) {
        return withoutCredentials(cut(word));
      }

      return looksLikeAddress(word) ? withoutCredentials(word) : word;
    })
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
