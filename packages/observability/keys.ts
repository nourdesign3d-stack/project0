import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {
      // Produit **Uptime** de BetterStack : clé d'API des moniteurs et adresse
      // de la page de statut publique, toutes deux lues par `status/index.tsx`.
      BETTERSTACK_API_KEY: z.string().optional(),
      BETTERSTACK_URL: z.url().optional(),

      // Produit **Telemetry** (journaux). Noms imposés par `@logtail/next`, qui
      // ne lit aucune autre orthographe : sans eux, il se rabat silencieusement
      // sur un affichage console et rien ne part. Mesuré le 2026-08-05 (D-028).
      BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
      BETTER_STACK_INGESTING_URL: z.url().optional(),

      // Added by Sentry Integration, Vercel Marketplace
      SENTRY_ORG: z.string().optional(),
      SENTRY_PROJECT: z.string().optional(),
    },
    client: {
      // Added by Sentry Integration, Vercel Marketplace
      NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    },
    runtimeEnv: {
      BETTERSTACK_API_KEY: process.env.BETTERSTACK_API_KEY,
      BETTERSTACK_URL: process.env.BETTERSTACK_URL,
      BETTER_STACK_SOURCE_TOKEN: process.env.BETTER_STACK_SOURCE_TOKEN,
      BETTER_STACK_INGESTING_URL: process.env.BETTER_STACK_INGESTING_URL,
      SENTRY_ORG: process.env.SENTRY_ORG,
      SENTRY_PROJECT: process.env.SENTRY_PROJECT,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
  });
