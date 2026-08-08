---
description: CI, environnements, variables, observabilité, rollback.
globs: [".github/**", "compose.yaml", "apps/*/vercel.json", "**/*.env.example"]
---

# Règles de déploiement

## CI (`.github/workflows/ci.yml`)

Chaîne exécutée sur `push` et `pull_request` :

```
setup (pnpm + cache) → prisma generate → lint → typecheck → test
  → test:hooks → test:scripts → test:launcher → boundaries → build (complet) → semgrep
```

- Les jobs utilisent `pnpm install --frozen-lockfile` : le lockfile fait foi.
- Permissions GitHub Actions minimales (`contents: read` par défaut).
- Actions tierces épinglées au **SHA de commit**, version en commentaire (D-009).
- **Aucun `|| true`**, aucune étape masquant un échec. Une étape non bloquante doit être
  nommée `(informatif)` et justifiée dans ce fichier.
- Le build est **complet** (D-031) : aucune application ne
  dépend d'un jeton de service pour se construire. Seul le job E2E Playwright reste
  conditionnel (`ENABLE_E2E`), faute de pouvoir versionner des identifiants de test.

## Environnements

| Environnement | Usage |
| --- | --- |
| local | `.env.local` par app, Postgres via `docker compose` |
| preview | déploiement par PR, données non réelles |
| production | données réelles — jamais utilisée comme environnement de test |

- Une variable **requise** manquante doit faire échouer le démarrage (validation Zod
  `@t3-oss/env-nextjs`), pas produire un comportement dégradé silencieux.
- Une variable optionnelle laissée à `""` échoue la validation : la commenter.
- Variables réellement requises : `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_WEB_URL`. Toutes les autres sont optionnelles côté schéma — voir
  `docs/DEPLOYMENT.md`.

## Observabilité

- Sentry est câblé dans `packages/observability`. Seul son **plugin de build** dépend de
  `VERCEL` ; le SDK s'initialise dès qu'un DSN existe, y compris en local (D-026). Sans DSN,
  l'application fonctionne normalement. Le filtrage des données de requête
  (`scrub.ts`) couvre erreurs **et** transactions — pas le canal `log` (R-022).
- Les logs passent par `packages/observability` (BetterStack optionnel).
- Un changement significatif doit être constatable : erreur remontée, log utile, ou
  métrique — sans donnée sensible.

## Livraison

- Le déploiement du code et l'activation d'une fonctionnalité risquée sont séparés
  (feature flags, `packages/feature-flags`).
- Migration avant code pour les changements « expand » ; jamais de migration destructive
  dans la même release que le changement de code qui en dépend.
- Toute release doit avoir un chemin de retour : rollback du déploiement **ou**
  roll-forward documenté. Si aucun des deux n'est possible, le dire avant de livrer.
- Procédure de contrôle avant livraison : `/release-readiness`.

## Interdits

- Modifier la production, ses données ou ses variables depuis une session de développement.
- Déclencher un déploiement sans autorisation explicite.
- Ajouter un secret dans un workflow, un artefact, un rapport ou un log.
