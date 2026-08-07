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

  test("retire une chaîne de requête au milieu d'un message", () => {
    // Le cas de tous les jours, et celui qui n'était pas couvert : un message
    // d'erreur de `fetch` embarque l'URL appelée. L'expression était ancrée en
    // début de chaîne, donc elle ne le voyait pas (D-035).
    const event = scrubRequest({
      message: "fetch failed: https://api.exemple.test/reset?token=SECRET-MSG",
      exception: {
        values: [{ value: "Error at /callback?code=SECRET-EXC returned 500" }],
      },
      breadcrumbs: [
        { message: "GET api.exemple.test/v1/x?key=SECRET-SANS-SCHEMA" },
      ],
    });

    expect(JSON.stringify(event)).not.toContain("SECRET-");
  });

  test("conserve le texte autour de l'URL amputée", () => {
    // Couper le jeton ne doit pas coûter le message : sans contexte, un
    // événement filtré devient inexploitable, et le filtre finit contourné.
    const { message } = scrubRequest({
      message:
        "fetch failed: https://api.exemple.test/reset?token=SECRET après 3 essais",
    });

    expect(message).toBe(
      "fetch failed: https://api.exemple.test/reset après 3 essais"
    );
  });

  test("filtre au-delà de la profondeur d'un événement volumineux", () => {
    // La borne de profondeur était de 12 : tout ce qui se trouvait plus bas
    // ressortait intact. Les cycles sont désormais traités séparément.
    let deep: Record<string, unknown> = { url: "/x?token=SECRET-PROFOND" };

    for (let level = 0; level < 30; level += 1) {
      deep = { child: deep };
    }

    expect(JSON.stringify(scrubRequest(deep))).not.toContain("SECRET-");
  });

  test("survit à une référence circulaire", () => {
    const event: Record<string, unknown> = { url: "/x?token=SECRET-CYCLE" };

    event.self = event;

    expect(() => scrubRequest(event)).not.toThrow();
    expect(event.url).toBe("/x");
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

  test("coupe un secret placé dans le fragment", () => {
    // Forme des redirections OAuth implicites : le jeton voyage après le `#`,
    // jamais envoyé au serveur mais bien présent dans un message d'erreur.
    // Cinq formes sur six passaient avant le 2026-08-07 (D-045).
    const event = scrubRequest({
      message: "échec sur https://app.test/callback#access_token=SECRET_OAUTH",
    });

    expect(JSON.stringify(event)).not.toContain("SECRET_OAUTH");
    expect(JSON.stringify(event)).toContain("/callback");
  });

  test("retire la partie userinfo d'une adresse", () => {
    const event = scrubRequest({
      message:
        "connexion refusée : postgresql://postgres:MOTDEPASSE@db.test:5432/app",
    });

    expect(JSON.stringify(event)).not.toContain("MOTDEPASSE");
    expect(JSON.stringify(event)).toContain("db.test");
  });

  test("coupe au premier séparateur quand les deux sont présents", () => {
    const event = scrubRequest({
      message: "https://app.test/x?cle=UN#jeton=DEUX",
    });

    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("UN");
    expect(serialized).not.toContain("DEUX");
  });

  test("ne touche pas un mot ordinaire portant un dièse", () => {
    // Un numéro de ticket ou une couleur ne sont pas des adresses : les tronquer
    // ferait perdre du contexte sans rien protéger.
    const event = scrubRequest({
      message: "régression #4212 sur la teinte #ff8800",
    });

    expect(JSON.stringify(event)).toContain("#4212");
    expect(JSON.stringify(event)).toContain("#ff8800");
  });
});
