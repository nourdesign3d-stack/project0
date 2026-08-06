import { expect, test } from "@playwright/test";

const AUTH_ROUTE = /sign-in|sign-up/;
const SIGN_IN_LINK = /sign in|se connecter/i;
// Ancrées : un libellé partiel attrape plusieurs éléments et Playwright refuse
// alors d'agir (« strict mode violation »). Constaté à la première exécution
// réelle : /password/i visait aussi le bouton « Show password », et
// /continue|sign in/i visait aussi « Continue with Google ».
const EMAIL_FIELD = /^(email address|email|adresse e-?mail)$/i;
const PASSWORD_FIELD = /^(password|mot de passe)$/i;
const SUBMIT_BUTTON = /^(continue|sign in|se connecter|continuer)$/i;
const VERIFICATION_CODE = /verification code|code de v[ée]rification/i;
const NOT_SIGN_IN_URL = /^(?!.*sign-in).*$/;
// Messages d'erreur de Clerk. Sélecteur de classe : ces nœuds ne portent pas de
// rôle ARIA exploitable. À revoir si le fournisseur d'identité change.
const CLERK_ERROR = '[class*="cl-formFieldErrorText"], [class*="cl-alertText"]';

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
// Clerk vérifie tout nouvel appareil par code à usage unique — donc à chaque
// exécution en CI, où la machine est toujours neuve. Sans code, ce test ne peut
// pas aller au bout. Avec une adresse de test Clerk (`+clerk_test@example.com`),
// le code attendu est fixe et documenté par le fournisseur.
const otp = process.env.E2E_USER_OTP;

test.describe("parcours authentifié", () => {
  /**
   * ⚠️ Aucun artefact pour ce parcours — et pour lui seul.
   *
   * Une trace Playwright enregistre les en-têtes **et les corps** des requêtes :
   * elle contient donc le `POST` de connexion, avec le mot de passe du compte de
   * test, et le `Set-Cookie` de session. La vidéo et les captures montrent le
   * code de vérification, saisi dans un champ texte ordinaire — pas un champ
   * masqué.
   *
   * Ces artefacts sont téléversés par la CI, et **GitHub ne caviarde jamais le
   * contenu d'un artefact** : il ne masque que les journaux. Tout collaborateur
   * du dépôt pouvait les télécharger. Relevé en audit le 2026-08-06 (D-037).
   *
   * Les autres parcours conservent trace, vidéo et captures : ils n'émettent que
   * des requêtes anonymes, et ce sont eux qui servent au diagnostic.
   */
  test.use({ trace: "off", video: "off", screenshot: "off" });

  test.skip(
    !(email && password),
    "E2E_USER_EMAIL / E2E_USER_PASSWORD non fournis — parcours authentifié non couvert"
  );

  test("un utilisateur authentifié atteint l'application", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(EMAIL_FIELD).fill(email as string);
    await page.getByLabel(PASSWORD_FIELD).fill(password as string);
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    // Vérification d'appareil : Clerk l'interpose entre le mot de passe et la
    // session. L'attente explicite évite aussi de contrôler le refus trop tôt,
    // avant que le fournisseur ait répondu.
    const codeField = page.getByRole("textbox", { name: VERIFICATION_CODE });
    const codeRequired = await codeField
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (codeRequired) {
      if (!otp) {
        throw new Error(
          "vérification d'appareil exigée par Clerk : fournir E2E_USER_OTP " +
            "(code fixe du fournisseur pour une adresse +clerk_test@example.com)"
        );
      }

      // Saisie caractère par caractère : le champ de Clerk est segmenté et
      // réagit à chaque frappe. `fill()` le remplissait parfois sans que le
      // fournisseur enregistre la valeur — le formulaire repartait alors avec
      // « Enter code. », de façon intermittente (constaté en CI le 2026-08-05).
      await codeField.pressSequentially(otp, { delay: 50 });
      // Clerk valide souvent dès la saisie complète ; le bouton peut avoir
      // disparu entre-temps, ce qui n'est pas un échec.
      await page
        .getByRole("button", { name: SUBMIT_BUTTON })
        .click({ timeout: 5000 })
        .catch(() => undefined);
    }

    // Le fournisseur peut refuser (compte inexistant, mot de passe faux, code
    // invalide). Sans ce contrôle, l'échec se présente comme « l'URL n'a pas
    // changé » et la vraie cause reste dans le rapport HTML.
    //
    // Le contrôle ne vaut que **sur la page de connexion**. Appliqué partout, il
    // ramassait le nom de l'application une fois la connexion réussie et faisait
    // échouer un parcours qui avait abouti — constaté en CI le 2026-08-05.
    // Le motif vide est ignoré : Clerk monte un conteneur d'alerte inoccupé.
    if (AUTH_ROUTE.test(new URL(page.url()).pathname)) {
      const rejections = (await page.locator(CLERK_ERROR).allInnerTexts())
        .map((text) => text.trim())
        .filter(Boolean);

      if (rejections.length > 0) {
        throw new Error(
          `authentification refusée par le fournisseur : ${rejections.join(" — ")}`
        );
      }
    }

    await expect(page).toHaveURL(NOT_SIGN_IN_URL, { timeout: 20_000 });

    // Quitter /sign-in ne prouve pas que l'application fonctionne : une erreur
    // serveur s'affiche à la même URL et laissait ce test au vert. C'est
    // exactement le cas d'une base sans migration, la table interrogée par la
    // page d'accueil authentifiée n'existant pas.
    const landing = await page.reload();

    expect(
      landing?.status(),
      "la page authentifiée n'est pas servie. Un 404 signale presque toujours " +
        "un compte de test sans organisation active : l'application refuse " +
        "l'accès aux données hors organisation, et c'est voulu — voir " +
        "docs/QUALITY_GATES.md, « Parcours authentifié »"
    ).toBeLessThan(400);
  });
});
