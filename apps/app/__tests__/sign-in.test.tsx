import { expect, test } from "vitest";
import Page, {
  metadata,
} from "../app/(unauthenticated)/sign-in/[[...sign-in]]/page";

/**
 * L'ancienne version faisait `expect(container).toBeDefined()` : une assertion
 * qui ne peut pas échouer, sur un composant Clerk chargé dynamiquement et donc
 * jamais monté en test. Elle rassurait sans rien vérifier.
 *
 * Ce qui est réellement vérifiable ici sans clé de service : les métadonnées de
 * la page, produites par `@repo/seo`. Le rendu du widget Clerk exige une
 * instance configurée — il est couvert par e2e/tests/access-control.spec.ts.
 */
test("compose des métadonnées à partir du titre de la page", () => {
  expect(String(metadata.title)).toContain("Welcome back");
  expect(metadata.description).toBe("Enter your details to sign in.");
});

test("exporte un composant de page", () => {
  expect(typeof Page).toBe("function");
});
