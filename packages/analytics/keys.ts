import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {
      /**
       * Région du projet PostHog. Détermine le point d'accès vers lequel le
       * proxy `/ingest` renvoie (`packages/next-config`).
       *
       * Défaut `eu` : un mauvais défaut de localisation des données coûte plus
       * cher qu'un défaut inutile. Doit correspondre à la région où le projet a
       * été créé — une clé `phc_` du nuage européen n'est pas reconnue par le
       * point d'accès américain.
       */
      POSTHOG_REGION: z.enum(["eu", "us"]).optional(),
    },
    client: {
      NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_").optional(),
      /**
       * Doit pointer sur le **proxy** de l'application (`https://…/ingest`), pas
       * sur `*.i.posthog.com` : appelé directement, le point d'accès est bloqué
       * par la plupart des bloqueurs de publicité, et la mesure devient
       * partielle sans que rien ne le signale.
       */
      NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
      NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().startsWith("G-").optional(),
    },
    runtimeEnv: {
      POSTHOG_REGION: process.env.POSTHOG_REGION,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    },
  });
