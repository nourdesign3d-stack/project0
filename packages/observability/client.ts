/*
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
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

    // Le client n'avait aucun filtre, alors que le serveur en annonçait un
    // comme « dernier filet ». Une URL de navigateur transporte régulièrement
    // un jeton en paramètre (D-026).
    sendDefaultPii: false,

    beforeSend: scrubRequest,
    beforeSendTransaction: scrubRequest,

    replaysOnErrorSampleRate: 1,

    /*
     * This sets the sample rate to be 10%. You may want this to be 100% while
     * in development and sample at a lower rate in production
     */
    replaysSessionSampleRate: 0.1,

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
      // `log` est exclu : le serveur applique déjà cette politique — « un
      // journal de débogage n'a pas à devenir un flux vers un tiers » — et le
      // client la contredisait, expédiant chaque `console.log` du navigateur.
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ],
  });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
