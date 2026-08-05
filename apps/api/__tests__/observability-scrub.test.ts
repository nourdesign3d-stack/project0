import { scrubRequest } from "@repo/observability/scrub";
import { describe, expect, test } from "vitest";

/**
 * Ce que ce test protège : ce qui **ne doit pas** quitter le serveur.
 *
 * Mesuré le 2026-08-05 sur un collecteur local : la graine ne filtrait que les
 * événements d'erreur. Les transactions — une par requête, qu'il y ait erreur
 * ou non — emportaient l'en-tête `authorization`, le cookie de session et le
 * corps complet. Le filtre est désormais unique et appliqué aux deux canaux ;
 * ce test le vérifie sur la forme exacte des charges utiles capturées.
 *
 * Il vit dans `apps/api` faute d'exécuteur de tests dans
 * `packages/observability` : le module est pur, aucun import serveur.
 */

// Forme réellement observée dans une enveloppe `type=transaction`, marqueurs
// compris : chaque emplacement ci-dessous a été capturé, pas supposé.
const capturedTransaction = () => ({
  transaction: "POST /boom",
  request: {
    url: "http://localhost:3000/boom?jeton=SECRET-URL",
    method: "POST",
    headers: {
      authorization: "Bearer SECRET-EN-TETE",
      cookie: "session=SECRET-COOKIE",
    },
    cookies: { session: "SECRET-COOKIE" },
    data: '{"carte":"SECRET-CORPS-REQUETE"}',
    query_string: "jeton=SECRET-URL",
  },
  contexts: {
    trace: { data: { "http.target": "/boom?jeton=SECRET-URL" } },
    nextjs: { request_path: "/boom?jeton=SECRET-URL" },
  },
});

describe("filtrage des événements Sentry", () => {
  test("retire en-têtes, cookies, corps et paramètres d'URL", () => {
    const { request } = scrubRequest(capturedTransaction());

    expect(request.headers).toBeUndefined();
    expect(request.cookies).toBeUndefined();
    expect(request.data).toBeUndefined();
    expect(request.query_string).toBeUndefined();
  });

  test("aucun marqueur sensible ne subsiste dans l'événement sérialisé", () => {
    // Contrôle de bout en bout plutôt que champ par champ : si le SDK ajoute
    // un jour un emplacement, l'assertion ci-dessus passerait et celle-ci non.
    const serialized = JSON.stringify(scrubRequest(capturedTransaction()));

    expect(serialized).not.toContain("SECRET-");
  });

  test("conserve ce qui rend un événement exploitable", () => {
    // Filtrer n'est utile que si le diagnostic reste possible : sans méthode ni
    // chemin, un événement ne sert plus à rien et le filtre serait rejeté à
    // l'usage — donc contourné.
    const { request, transaction, contexts } = scrubRequest(
      capturedTransaction()
    );

    expect(transaction).toBe("POST /boom");
    expect(request.url).toBe("http://localhost:3000/boom");
    expect(request.method).toBe("POST");
    expect(contexts.trace.data["http.target"]).toBe("/boom");
    expect(contexts.nextjs.request_path).toBe("/boom");
  });

  test("n'ampute pas une chaîne qui n'est pas une URL", () => {
    // La politique vise les URL, pas tout texte contenant un point
    // d'interrogation — un message d'erreur en pose souvent un.
    const event = scrubRequest({
      message: "Quel est le problème ? aucun",
      request: { url: "/x" },
    });

    expect(event.message).toBe("Quel est le problème ? aucun");
  });

  test("supporte un événement sans requête", () => {
    // Une erreur levée hors contexte HTTP — tâche planifiée, démarrage.
    expect(() => scrubRequest({ transaction: "cron" })).not.toThrow();
  });
});
