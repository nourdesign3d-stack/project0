---
description: Frontières entre apps et packages, dépendances, découpage du code.
globs: ["apps/**", "packages/**", "turbo.json", "pnpm-workspace.yaml"]
---

# Règles d'architecture

## Topologie réelle

```
apps/app        Next.js 16 — application authentifiée (port 3000)
apps/web        Next.js 16 — site public + CMS BaseHub (3001)
apps/api        Next.js 16 — webhooks, cron, health (3002)
apps/email      react-email — prévisualisation des templates (3003)
apps/docs       Mintlify — documentation produit (3004)
apps/studio     Prisma Studio (3005)
apps/storybook  Catalogue de composants (6006)

packages/       ai, analytics, auth, cms, collaboration, database, design-system,
                email, feature-flags, internationalization, next-config,
                notifications, observability, payments, rate-limit, security,
                seo, storage, typescript-config, webhooks
```

## Frontières

- `apps/*` dépend de `packages/*`. **Jamais** l'inverse, **jamais** app → app.
- Un package ne connaît pas l'application qui l'utilise : pas de chemin `@/`, pas de
  supposition sur les routes de l'appelant.
- Le code partagé par au moins deux apps va dans un package ; le code utilisé par une
  seule app reste dans l'app.
- Pas de dépendance circulaire entre packages. Vérification : `pnpm boundaries`.
- Chaque package expose un point d'entrée explicite (`index.ts` / sous-chemins déclarés).
  Ne pas importer un fichier interne d'un autre package en contournant son entrée.

## Next.js

- Server Components par défaut. `"use client"` au niveau le plus bas possible, jamais
  sur un layout ou une page entière « par confort ».
- La base de données, les secrets et les SDK privilégiés restent côté serveur.
  Un package serveur importe `server-only`.
- Ne pas envoyer au client plus de données que nécessaire : sélectionner les champs,
  ne pas sérialiser un objet Prisma entier vers un composant client.
- Cache et revalidation explicites : chaque `fetch`/`cache()`/`revalidatePath` doit être
  un choix conscient et commenté quand il n'est pas évident.

## TypeScript

- `strict` activé (`packages/typescript-config/base.json`). Ne pas l'affaiblir.
- Interdits : `any` de confort, `as unknown as`, `@ts-ignore`, `@ts-expect-error` sans
  commentaire justifiant et datant la dette.
- Un type doit venir de la source (SDK installé) plutôt que d'un package de types
  parallèle susceptible de dériver — voir `packages/auth/provider.tsx` pour le motif
  `ComponentProps<typeof X>`.
- Validation runtime (Zod) à toutes les frontières ; le typage statique ne remplace pas
  la validation des entrées externes.

## Changements structurants

Avant de déplacer du code, créer un package ou introduire une abstraction :
justifier par au moins deux usages réels, vérifier l'impact avec `pnpm graph`, et
consigner la décision dans `docs/DECISIONS.md`.
