// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { log } from "./log";

/**
 * Extrait un message lisible d'une erreur, et décide si elle mérite d'être
 * remontée à Sentry.
 *
 * ⚠️ La version précédente appelait `captureException` **systématiquement**. Sur
 * les frontières publiques, cela signifiait un événement Sentry par signature de
 * webhook refusée — c'est-à-dire un par appel forgé. Un dépôt sans limitation de
 * débit (R-003) offrait donc à n'importe quel appelant anonyme le moyen de
 * remplir le quota Sentry du projet, et surtout de **noyer les vraies erreurs**
 * sous du bruit qu'il contrôle. Relevé en audit le 2026-08-07 (D-052).
 *
 * `expected: true` marque une erreur **attendue** : un refus de validation, une
 * signature invalide, une entrée malformée. Elle est journalisée — le refus doit
 * rester visible — mais ne devient pas un incident.
 *
 * Le défaut reste `false` : oublier l'option remonte l'erreur, ce qui est le
 * sens le moins dangereux des deux.
 */
export const parseError = (
  error: unknown,
  { expected = false }: { expected?: boolean } = {}
): string => {
  let message = "An error occurred";

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    message = error.message as string;
  } else {
    message = String(error);
  }

  try {
    if (!expected) {
      Sentry.captureException(error);
    }

    log.error(`Parsing error: ${message}`);
  } catch (newError) {
    console.error("Error parsing error:", newError);
  }

  return message;
};
