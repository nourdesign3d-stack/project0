# Déploiement

## Chaîne d'intégration continue

`.github/workflows/ci.yml`, déclenché sur `push` et `pull_request` :

| Job | Contenu | Condition |
| --- | --- | --- |
| `quality` | install figé → `prisma generate` → `lint` → `typecheck` → `test` → build `app` + `api` | toujours |
| `semgrep` | analyse statique de sécurité (conteneur officiel Semgrep) | toujours |
| `build-full` | `pnpm build` complet (inclut `@repo/cms` et `apps/web`) | `vars.ENABLE_FULL_BUILD == 'true'` **et** secret `BASEHUB_TOKEN` configuré |
| `e2e` | Playwright sur les parcours critiques | `vars.ENABLE_E2E == 'true'` |

Permissions : `contents: read` au niveau du workflow. Aucun job de test n'obtient
d'autorisation d'écriture.

Pour activer les jobs conditionnels : *Settings → Secrets and variables → Actions →
Variables* → `ENABLE_FULL_BUILD` / `ENABLE_E2E` = `true`, après avoir renseigné les secrets
correspondants.

## Protection de `main`

⚠️ **Aucune protection côté serveur.** Le dépôt est privé sur un plan GitHub gratuit :
l'API refuse aussi bien les branches protégées que les rulesets
(`403 — Upgrade to GitHub Pro or make this repository public`).

Ce qui est en place à la place :

- un hook `pre-push` versionné dans `.githooks/` qui refuse un push direct sur `main` ;
- activation obligatoire après clonage : `pnpm hooks:install` ;
- exception assumée et tracée : `ALLOW_DIRECT_PUSH_MAIN=1 git push origin main`.

**Ce hook n'est pas un contrôle de sécurité** : il est local, contournable, et ne
s'applique qu'aux postes qui l'ont activé. Rien n'empêche techniquement une fusion sans
CI verte. La discipline repose donc sur la revue et sur `QUALITY_GATES.md`.

Pour obtenir une vraie protection : passer le dépôt en public, ou souscrire GitHub Pro.
La règle à appliquer alors — PR obligatoire, checks requis `Lint · Typecheck · Test · Build`
et `Semgrep`, historique linéaire, force-push et suppression interdits — est prête et
n'attend que le déblocage du plan. Suivi : risque R-011 dans `RISKS.md`.

## Variables d'environnement

Chaque app possède son `.env.example` (versionné, **sans valeur**) et son `.env.local`
(non versionné).

`pnpm env:setup` crée les `.env.local` manquants à partir des `.env.example` : il commente
les variables sans valeur (sinon la validation Zod échoue) et renseigne `DATABASE_URL`
depuis le `.env` racine. Il **n'écrase jamais** un fichier existant sans `--force`.
`pnpm project:init` l'appelle automatiquement.

### Réellement requises

| Variable | Format | Utilisée par |
| --- | --- | --- |
| `DATABASE_URL` | URL Postgres | `@repo/database` (toutes les apps) |
| `NEXT_PUBLIC_APP_URL` | URL | `@repo/next-config` |
| `NEXT_PUBLIC_WEB_URL` | URL | `@repo/next-config` |

Sans elles, le démarrage et le build échouent — comportement voulu.

### Requise si le cron est utilisé

| Variable | Format | Conséquence si absente |
| --- | --- | --- |
| `CRON_SECRET` | chaîne libre, envoyée par Vercel Cron en `Authorization: Bearer …` | `/cron/keep-alive` répond **503** et ne réveille plus la base : sur Neon, l'instance finit par se suspendre. Le silence est le symptôme. |

### Optionnelles mais structurantes

`CLERK_SECRET_KEY` (`sk_…`), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_…`),
`CLERK_WEBHOOK_SECRET` (`whsec_…`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`BASEHUB_TOKEN`, `RESEND_TOKEN`, `RESEND_FROM`, `ARCJET_KEY`, `SVIX_TOKEN`,
`LIVEBLOCKS_SECRET`, `KNOCK_*`, `UPSTASH_REDIS_REST_*`, `FLAGS_SECRET`,
`BETTERSTACK_*`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_POSTHOG_*`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

⚠️ **Une variable optionnelle laissée à `""` échoue la validation Zod** (ex. `BETTERSTACK_URL=""`
n'est pas une URL valide). La commenter tant qu'elle n'a pas de valeur réelle.

⚠️ `VERCEL_PROJECT_PRODUCTION_URL` attend un **hôte sans schéma** (`localhost:3000`), le
code y préfixe `http(s)://`. Le template livrait `http://localhost:3000`, corrigé ici.

## Base de données

```bash
docker compose up -d          # Postgres local (port hôte défini par POSTGRES_PORT)
pnpm migrate                  # migration de développement
pnpm migrate:status           # état des migrations
pnpm migrate:deploy           # application en environnement déployé
```

`pnpm db:push` est réservé au prototypage local jetable (bloqué pour l'agent).

`packages/database/prisma.config.ts` charge lui-même `.env.local` puis `.env` : Prisma 7
ne le fait plus automatiquement quand un fichier de configuration est présent. Sans cela,
toutes les commandes Prisma échouent sur « Connection url is empty ». La configuration
lève désormais une erreur explicite si `DATABASE_URL` est absente.

Ordre de déploiement :

1. migration **expand** (compatible avec le code déjà en ligne) ;
2. déploiement du code ;
3. migration **contract** dans une release ultérieure.

## Observabilité

- Sentry est activé uniquement lorsque la variable `VERCEL` est définie
  (`apps/*/next.config.ts`) → pas de bruit en local. Sans DSN, l'application fonctionne.
- Séparer les environnements Sentry (dev / preview / staging / production) et associer les
  erreurs aux releases lors de la mise en place réelle.
- Filtrer les données sensibles avant envoi (corps de requête, en-têtes, jetons).
- Les logs passent par `@repo/observability` ; BetterStack est optionnel.

## Récupération

À définir avant la première mise en production :

- fréquence et rétention des sauvegardes de base ;
- procédure de restauration **testée** ;
- procédure de rollback applicatif ;
- responsable d'astreinte.

Tant que ces points ne sont pas établis, toute mise en production est un
`READY_WITH_KNOWN_RISKS` au mieux (voir `/release-readiness`).
