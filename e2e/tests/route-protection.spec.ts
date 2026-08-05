import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  collectRoutes,
  PUBLIC_ROUTES,
  toUrlPath,
} from "../../apps/app/__tests__/routes";

// Playwright s'exécute depuis la racine du dépôt.
const APP_DIR = join(process.cwd(), "apps", "app", "app");

/**
 * R-013, deuxième étage. `apps/app/__tests__/route-protection.test.ts` constate
 * qu'un contrôle d'autorisation **existe** ; il ne peut pas juger s'il refuse.
 * Un `auth()` dont on ignore le résultat le satisfait.
 *
 * Ici, chaque route non déclarée publique est réellement interrogée **sans
 * session**, et doit refuser. Ce test attrape donc les deux cas : la route sans
 * contrôle, et le contrôle qui ne contrôle rien.
 *
 * Aucune donnée n'est envoyée : seules des requêtes anonymes sont émises.
 */

const REFUSALS = [401, 403, 404];
// 405 : la méthode n'est pas exposée. Ce n'est pas un refus d'autorisation, mais
// la ressource n'est pas atteignable ainsi — l'essayer avec l'autre verbe suffit.
const METHOD_NOT_ALLOWED = 405;
const SIGN_IN_LOCATION = /sign-in|sign-up|accounts\.dev/;

const protectedRoutes = collectRoutes(APP_DIR)
  .filter((route) => !PUBLIC_ROUTES.includes(route))
  .map(toUrlPath);

test("l'inventaire des routes protégées n'est pas vide", () => {
  // Sans cela, une erreur d'énumération rendrait toute la suite verte en
  // n'interrogeant rien.
  expect(protectedRoutes.length).toBeGreaterThan(0);
});

for (const path of protectedRoutes) {
  test(`refuse un accès anonyme à ${path}`, async ({ request }) => {
    const attempts = await Promise.all(
      (["get", "post"] as const).map((method) =>
        request.fetch(path, {
          method,
          maxRedirects: 0,
          failOnStatusCode: false,
        })
      )
    );

    for (const response of attempts) {
      const status = response.status();

      if (status === METHOD_NOT_ALLOWED) {
        continue;
      }

      // Redirection : elle doit mener à l'authentification, pas ailleurs.
      if (status >= 300 && status < 400) {
        expect(
          response.headers().location ?? "",
          `${path} redirige, mais pas vers l'authentification`
        ).toMatch(SIGN_IN_LOCATION);

        continue;
      }

      expect(
        REFUSALS,
        `${path} a répondu ${status} à une requête anonyme : la route est exposée`
      ).toContain(status);
    }
  });
}
