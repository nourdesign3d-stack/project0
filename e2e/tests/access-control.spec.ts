import { expect, test } from "@playwright/test";

const AUTH_ROUTE = /sign-in|sign-up/;
const SIGN_IN_LINK = /sign in|se connecter/i;
const EMAIL_FIELD = /email/i;
const PASSWORD_FIELD = /password|mot de passe/i;
const SUBMIT_BUTTON = /continue|sign in/i;
const NOT_SIGN_IN_URL = /^(?!.*sign-in).*$/;

const UNAUTHORIZED_STATUSES = [401, 403, 404];

/**
 * Contrôle d'accès : un visiteur non authentifié ne doit pas atteindre l'application.
 * Tester le refus est au moins aussi important que tester le succès
 * (voir .claude/rules/quality.md).
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

/**
 * Parcours authentifié : volontairement ignoré tant qu'aucun compte de test n'est
 * fourni — un test ignoré et signalé vaut mieux qu'un parcours silencieusement absent.
 * Ne jamais utiliser d'identifiants de production ici.
 */
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe("parcours authentifié", () => {
  test.skip(
    !(email && password),
    "E2E_USER_EMAIL / E2E_USER_PASSWORD non fournis — parcours authentifié non couvert"
  );

  test("un utilisateur authentifié atteint l'application", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(EMAIL_FIELD).fill(email as string);
    await page.getByLabel(PASSWORD_FIELD).fill(password as string);
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    await expect(page).toHaveURL(NOT_SIGN_IN_URL, { timeout: 20_000 });
  });
});
