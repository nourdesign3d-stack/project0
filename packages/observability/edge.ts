/*
 * This file configures the initialization of Sentry for edge runtime.
 * The config you add here will be used whenever a page or API route is loaded in an edge runtime.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";
import { scrubRequest } from "./scrub";

export const initializeSentry = (): ReturnType<typeof Sentry.init> =>
  Sentry.init({
    dsn: keys().NEXT_PUBLIC_SENTRY_DSN,

    // Enable logging
    enableLogs: true,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Ce runtime exécute le proxy : il voit **toutes** les requêtes, y compris
    // celles qui n'atteindront jamais l'application. Il n'avait aucun filtre,
    // et sa transaction « middleware » emportait en-tête et cookie (D-026).
    sendDefaultPii: false,

    beforeSend: scrubRequest,
    beforeSendTransaction: scrubRequest,

    integrations: [
      // `log` est exclu : un journal de débogage n'a pas à devenir un flux vers
      // un tiers. Même politique que le runtime serveur.
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ],
  });
