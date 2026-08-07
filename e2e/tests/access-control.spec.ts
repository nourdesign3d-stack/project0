import { expect, test } from "@playwright/test";

const AUTH_ROUTE = /sign-in|sign-up/;
const SIGN_IN_LINK = /sign in|se connecter/i;

const UNAUTHORIZED_STATUSES = [401, 403, 404];

/**
 * Contrôle d'accès : un visiteur non authentifié ne doit pas atteindre l'application.
 * Tester le refus est au moins aussi important que tester le succès
 * (voir .claude/rules/quality.md).
 *
 * Le parcours **authentifié** vit dans `authenticated-journey.spec.ts` : il
 * désactive les artefacts Playwright (D-037), et `video`/`screenshot` sont des
 * options de worker qui ne s'appliquent qu'au niveau d'un fichier entier.
 */
test.describe("contrôle d'accès", () => {
  test("un visiteur anonyme est renvoyé vers l'authentification", async ({
    page,
  }) => {
    await page.goto("/");

    // apps/app protège ses routes via proxy.ts : la racine mène soit à /sign-in,
    // soit à une page proposant explicitement de se connecter.
    const { pathname } = new URL(page.url());

    if (!AUTH_ROUTE.test(pathname)) {
      await expect(
        page.getByRole("link", { name: SIGN_IN_LINK }).first(),
        "ni redirection vers /sign-in, ni lien de connexion visible"
      ).toBeVisible();
    }
  });

  test("une route d'API interne refuse un appel non authentifié", async ({
    request,
  }) => {
    const response = await request.post("/api/collaboration/auth", {
      data: {},
      failOnStatusCode: false,
    });

    expect(
      UNAUTHORIZED_STATUSES,
      `statut inattendu : ${response.status()}`
    ).toContain(response.status());
  });
});
