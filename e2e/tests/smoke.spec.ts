import { expect, test } from "@playwright/test";

const NON_EMPTY = /.+/;

/**
 * Smoke : l'application répond et rend une page HTML exploitable.
 * Ce test ne doit dépendre d'aucune donnée métier.
 */
test.describe("smoke", () => {
  test("la racine répond sans erreur serveur", async ({ page }) => {
    const response = await page.goto("/");

    expect(response, "aucune réponse HTTP reçue").not.toBeNull();
    expect(response?.status(), "statut HTTP en erreur").toBeLessThan(400);

    await expect(page.locator("html")).toHaveAttribute("lang", NON_EMPTY);
  });

  test("aucune erreur console bloquante au chargement", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    expect(errors, `erreurs JavaScript : ${errors.join(" | ")}`).toHaveLength(
      0
    );
  });
});
