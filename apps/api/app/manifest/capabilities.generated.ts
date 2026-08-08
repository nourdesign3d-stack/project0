// Généré par `pnpm manifest` — ne pas modifier à la main.
//
// La route /manifest s'en sert pour dire **quelles variables sont présentes**,
// jamais leur valeur. C'est la seule chose que le dépôt ne peut pas savoir :
// elle dépend de l'environnement, pas du code.

export const CAPABILITY_ENV: ReadonlyArray<{
  readonly id: string;
  readonly provider: string | null;
  readonly criticality: string;
  readonly requiredEnv: readonly string[];
}> = [
  {
    "id": "ai",
    "provider": "OpenAI (AI SDK)",
    "criticality": "low",
    "requiredEnv": [
      "OPENAI_API_KEY"
    ]
  },
  {
    "id": "analytics",
    "provider": "PostHog",
    "criticality": "medium",
    "requiredEnv": [
      "NEXT_PUBLIC_GA_MEASUREMENT_ID",
      "NEXT_PUBLIC_POSTHOG_HOST",
      "NEXT_PUBLIC_POSTHOG_KEY",
      "POSTHOG_REGION"
    ]
  },
  {
    "id": "build-config",
    "provider": null,
    "criticality": "medium",
    "requiredEnv": [
      "ANALYZE",
      "NEXT_PUBLIC_API_URL",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_DOCS_URL",
      "NEXT_PUBLIC_WEB_URL",
      "NEXT_RUNTIME",
      "VERCEL",
      "VERCEL_ENV",
      "VERCEL_PROJECT_PRODUCTION_URL",
      "VERCEL_REGION",
      "VERCEL_URL"
    ]
  },
  {
    "id": "collaboration",
    "provider": "Liveblocks",
    "criticality": "low",
    "requiredEnv": [
      "LIVEBLOCKS_SECRET"
    ]
  },
  {
    "id": "database",
    "provider": "PostgreSQL",
    "criticality": "high",
    "requiredEnv": [
      "DATABASE_URL"
    ]
  },
  {
    "id": "design-system",
    "provider": null,
    "criticality": "medium",
    "requiredEnv": []
  },
  {
    "id": "email",
    "provider": "Resend",
    "criticality": "medium",
    "requiredEnv": [
      "RESEND_FROM",
      "RESEND_TOKEN"
    ]
  },
  {
    "id": "feature-flags",
    "provider": "Vercel Flags",
    "criticality": "medium",
    "requiredEnv": [
      "FLAGS_SECRET"
    ]
  },
  {
    "id": "i18n",
    "provider": null,
    "criticality": "low",
    "requiredEnv": []
  },
  {
    "id": "identity",
    "provider": "Clerk",
    "criticality": "high",
    "requiredEnv": [
      "CLERK_SECRET_KEY",
      "CLERK_WEBHOOK_SECRET",
      "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL",
      "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
      "NEXT_PUBLIC_CLERK_SIGN_UP_URL"
    ]
  },
  {
    "id": "notifications",
    "provider": "Knock",
    "criticality": "low",
    "requiredEnv": [
      "KNOCK_SECRET_API_KEY",
      "NEXT_PUBLIC_KNOCK_API_KEY",
      "NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID"
    ]
  },
  {
    "id": "observability",
    "provider": "Sentry, BetterStack",
    "criticality": "high",
    "requiredEnv": [
      "BETTERSTACK_API_KEY",
      "BETTERSTACK_URL",
      "BETTER_STACK_INGESTING_URL",
      "BETTER_STACK_SOURCE_TOKEN",
      "NEXT_PUBLIC_SENTRY_DSN",
      "SENTRY_ORG",
      "SENTRY_PROJECT"
    ]
  },
  {
    "id": "payments",
    "provider": "Stripe",
    "criticality": "high",
    "requiredEnv": [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET"
    ]
  },
  {
    "id": "rate-limit",
    "provider": "Upstash",
    "criticality": "high",
    "requiredEnv": [
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_REST_URL"
    ]
  },
  {
    "id": "security",
    "provider": "Nosecone",
    "criticality": "high",
    "requiredEnv": []
  },
  {
    "id": "seo",
    "provider": null,
    "criticality": "low",
    "requiredEnv": []
  },
  {
    "id": "storage",
    "provider": "Vercel Blob",
    "criticality": "low",
    "requiredEnv": [
      "BLOB_READ_WRITE_TOKEN"
    ]
  },
  {
    "id": "typescript-config",
    "provider": null,
    "criticality": "low",
    "requiredEnv": []
  },
  {
    "id": "webhooks",
    "provider": "Svix",
    "criticality": "medium",
    "requiredEnv": [
      "SVIX_TOKEN"
    ]
  }
];
