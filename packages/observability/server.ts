/*
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";

export const initializeSentry = (): ReturnType<typeof Sentry.init> =>
  Sentry.init({
    dsn: keys().NEXT_PUBLIC_SENTRY_DSN,

    // Enable logging
    enableLogs: true,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Désactivé volontairement : les variables locales d'une frontière serveur
    // contiennent corps de requête, jetons et données personnelles. Le confort
    // de débogage ne justifie pas de les envoyer à un tiers.
    // Voir .claude/rules/security.md et docs/SECURITY_MODEL.md.
    includeLocalVariables: false,

    // Ne pas envoyer les données de la requête (corps, en-têtes, cookies).
    sendDefaultPii: false,

    // Dernier filet : retirer le corps et les en-têtes avant envoi.
    // Sentry complète les logs, il ne doit pas devenir un entrepôt de données.
    beforeSend(event) {
      if (event.request) {
        event.request.data = undefined;
        event.request.headers = undefined;
        event.request.cookies = undefined;
      }
      return event;
    },

    integrations: [
      // Les logs d'erreur et d'avertissement remontent ; `log` est exclu pour
      // ne pas transformer un journal de débogage en flux vers un tiers.
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ],
  });
