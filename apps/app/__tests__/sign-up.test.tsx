import { expect, test } from "vitest";
import Page, {
  metadata,
} from "../app/(unauthenticated)/sign-up/[[...sign-up]]/page";

// Même raison que sign-in.test.tsx : on vérifie ce qui est vérifiable sans clé.
test("compose des métadonnées à partir du titre de la page", () => {
  expect(String(metadata.title)).toContain("Create an account");
  expect(metadata.description).toBe("Enter your details to get started.");
});

test("exporte un composant de page", () => {
  expect(typeof Page).toBe("function");
});
