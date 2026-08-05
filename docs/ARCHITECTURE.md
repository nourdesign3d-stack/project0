# Architecture

État constaté au 2026-08-04 par inspection du dépôt. Ce document ne décrit que ce qui
existe réellement.

## Vue d'ensemble

Monorepo pnpm + Turborepo. Monolithe modulaire : les applications Next.js consomment des
packages partagés ; aucune communication inter-applications.

```
apps/                       packages/
  app     (3000)  ───┐        auth, database, design-system, analytics,
  web     (3001)  ───┼──────► collaboration, feature-flags, next-config,
  api     (3002)  ───┘        notifications, observability, security, seo,
  email   (3003)              webhooks, payments, rate-limit, storage, cms,
  docs    (3004)              email, internationalization, ai, typescript-config
  studio  (3005)
  storybook (6006)
```

## Applications

| App | Rôle | Dépendances notables |
| --- | --- | --- |
| `apps/app` | Application authentifiée : sign-in/up, recherche, collaboration, webhooks internes | auth, database, collaboration, design-system, feature-flags, notifications, observability, security, seo, webhooks, analytics |
| `apps/web` | Site public, blog et pages légales alimentés par le CMS | cms, design-system, seo, internationalization, observability, security |
| `apps/api` | Webhooks entrants (Clerk, Stripe), cron `keep-alive`, `/health` | analytics, auth, database, email, next-config, observability, payments |
| `apps/email` | Prévisualisation react-email des templates de `packages/email` | email |
| `apps/docs` | Documentation Mintlify (`mintlify dev`, `mintlify broken-links`) | — |
| `apps/studio` | Prisma Studio sur le schéma de `packages/database` | prisma |
| `apps/storybook` | Catalogue des composants du design system | design-system |

## Packages

| Package | Responsabilité | Frontière |
| --- | --- | --- |
| `@repo/auth` | Clerk : provider, middleware, helpers serveur | expose `provider`, `server`, `client`, `keys` |
| `@repo/database` | Prisma 7 + adaptateur Neon ; client généré dans `generated/` | serveur uniquement |
| `@repo/design-system` | Composants shadcn/ui, thème, providers | client + serveur |
| `@repo/next-config` | Config Next partagée, variables de base | build |
| `@repo/observability` | Sentry, logs BetterStack, instrumentation | serveur + client |
| `@repo/security` | Nosecone (en-têtes de sécurité) — Arcjet retiré, voir D-014 | serveur |
| `@repo/rate-limit` | Limitation de débit Upstash | serveur |
| `@repo/payments` | SDK Stripe (le module `ai.ts` a été retiré — voir DECISIONS D-003) | serveur |
| `@repo/webhooks` | Svix (webhooks sortants) | serveur |
| `@repo/notifications` | Knock (in-app + e-mail) | serveur + client |
| `@repo/email` | Templates react-email + Resend | serveur |
| `@repo/cms` | BaseHub (contenu du site public) | build + serveur |
| `@repo/collaboration` | Liveblocks (présence, curseurs) | client + serveur |
| `@repo/feature-flags` | Flags Vercel + toolbar | build + serveur |
| `@repo/analytics` | PostHog, Google Analytics | client |
| `@repo/seo` | `metadata`, JSON-LD | build |
| `@repo/storage` | Stockage compatible S3 (Vercel Blob) | serveur |
| `@repo/internationalization` | Traductions, middleware locale | build + serveur |
| `@repo/ai` | Vercel AI SDK, modèles OpenAI | serveur — **non utilisé** par une app |
| `@repo/typescript-config` | Configurations TS partagées (`base`, `nextjs`, `react-library`) | build |

## Flux principaux

1. **Authentification** — Clerk gère sessions et organisations. `apps/app/proxy.ts`
   **initialise Clerk et pose les en-têtes de sécurité ; il n'appelle pas `auth.protect()`
   et ne protège donc aucune route.** La redirection observée vient du layout
   `app/(authenticated)/layout.tsx`. Toute route ajoutée hors de ce layout — API,
   route handler, action serveur — est publique tant qu'elle ne vérifie pas
   l'authentification elle-même.
2. **Données** — Prisma Client (généré) → adaptateur Neon → Postgres. Accès serveur uniquement.
3. **Webhooks entrants** — Clerk et Stripe → `apps/api/app/webhooks/*` → vérification de
   signature → traitement.
4. **Contenu public** — BaseHub → `@repo/cms` → `apps/web` au build et au runtime.
5. **Observabilité** — erreurs → Sentry (uniquement si `VERCEL` défini) ; logs → BetterStack
   si configuré, sinon console.

## Dépendances externes

Clerk, Neon (Postgres), Stripe, BaseHub, Resend, Knock, Liveblocks, Upstash,
Svix, PostHog, Sentry, BetterStack, Vercel Blob.

Chacune est un point de défaillance : timeout, retry borné et comportement dégradé
doivent être décidés **au cas par cas** lors de l'usage réel (rien n'est implémenté à ce
stade au-delà des valeurs par défaut des SDK).

## Règles de frontière

- `apps/*` → `packages/*` uniquement. Jamais app → app, jamais package → app.
- Vérification : `pnpm boundaries` (Turborepo) et `pnpm graph` (dependency-cruiser).
- Chaque package expose son API par son point d'entrée ; ne pas importer un fichier interne.

## Décisions importantes

Consignées dans [DECISIONS.md](./DECISIONS.md), notamment les corrections de dérive de
versions appliquées au template lors de l'initialisation.
