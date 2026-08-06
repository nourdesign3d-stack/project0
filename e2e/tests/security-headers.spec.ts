import { expect, test } from "@playwright/test";

/**
 * `SECURITY_MODEL.md` déclarait les en-têtes de sécurité « actifs » depuis le
 * premier jour. Personne ne les avait jamais regardés. Un audit externe l'a fait
 * le 2026-08-06 : `apps/web` n'en servait **aucun**, et `apps/api` non plus
 * (D-034).
 *
 * Une case cochée dans un document n'est pas un contrôle. Ce test interroge
 * l'application en marche et lit ce qui sort réellement.
 *
 * Il porte sur `apps/app`, la seule application démarrée par la suite e2e.
 * `apps/web` et `apps/api` sont vérifiés à la main lors d'un changement du
 * proxy — leur couverture automatique demanderait de démarrer trois serveurs.
 */

const EXPECTED = [
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "cross-origin-opener-policy",
];

test("les en-têtes de sécurité sont réellement servis", async ({ request }) => {
  const response = await request.get("/", {
    maxRedirects: 0,
    failOnStatusCode: false,
  });

  const headers = response.headers();

  for (const name of EXPECTED) {
    expect(headers[name], `en-tête absent : ${name}`).toBeDefined();
  }
});

test("la pile n'est pas annoncée", async ({ request }) => {
  // `X-Powered-By` renseigne gratuitement sur la technologie et sa version.
  const response = await request.get("/", {
    maxRedirects: 0,
    failOnStatusCode: false,
  });

  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("les en-têtes survivent à une redirection", async ({ request }) => {
  // Le défaut trouvé venait précisément d'une réponse de redirection qui
  // écrasait celle portant les en-têtes. Une redirection est une réponse
  // comme une autre : elle doit les porter aussi.
  const response = await request.get("/", {
    maxRedirects: 0,
    failOnStatusCode: false,
  });

  if (response.status() >= 300 && response.status() < 400) {
    expect(
      response.headers()["x-frame-options"],
      "une redirection sans en-têtes de sécurité"
    ).toBeDefined();
  }
});
