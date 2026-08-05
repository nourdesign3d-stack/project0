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
 *
 * `query_string` est inclus : une URL transporte régulièrement un jeton de
 * réinitialisation ou un identifiant de session.
 */

interface RequestBearing {
  request?: Record<string, unknown>;
}

/** Profondeur suffisante pour un événement Sentry, et borne contre un cycle. */
const MAX_DEPTH = 12;

const URL_WITH_QUERY = /^(?:https?:\/\/|\/)[^\s]*\?/;

/**
 * Une chaîne de requête ne sort pas, **où qu'elle se trouve**.
 *
 * La première version ne vidait que `request.query_string`. La mesure a montré
 * que le jeton d'URL survivait à trois autres endroits : `request.url`,
 * `contexts.trace.data["http.target"]` et `contexts.nextjs.request_path`. Une
 * liste de champs aurait été à refaire à chaque version du SDK ; une politique
 * appliquée à toute valeur ressemblant à une URL tient dans la durée.
 *
 * Le chemin est conservé — sans lui, un événement ne sert plus à rien.
 */
const stripQueryStrings = (node: unknown, depth = 0): void => {
  if (depth > MAX_DEPTH || !(node && typeof node === "object")) {
    return;
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string") {
      if (URL_WITH_QUERY.test(value)) {
        (node as Record<string, unknown>)[key] = value.slice(
          0,
          value.indexOf("?")
        );
      }
    } else {
      stripQueryStrings(value, depth + 1);
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

  stripQueryStrings(event);

  return event;
};
