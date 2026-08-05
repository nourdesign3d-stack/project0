# CLAUDE.md

Monorepo Turborepo basé sur **next-forge v6** (Next.js 16, React 19, TypeScript 5.9,
Prisma 7, pnpm 10). Ce fichier décrit **comment travailler ici**. Les règles détaillées
sont dans `.claude/rules/`, la connaissance du projet dans `docs/`.

## Boucle de travail obligatoire

1. **Inspecter avant de modifier** — lire le code réellement concerné, pas seulement le fichier cible.
2. **Lire les documents pertinents** — `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md`,
   `docs/SECURITY_MODEL.md`, `docs/QUALITY_GATES.md` selon la nature du changement.
3. **Comprendre le besoin** — critères d'acceptation explicites. Toute hypothèse est
   annoncée comme hypothèse et consignée dans `docs/ASSUMPTIONS.md`.
4. **Identifier les impacts** — apps/packages touchés, contrats, données, permissions, cache, déploiement.
5. **Faire le plus petit changement cohérent** — pas de refonte opportuniste, pas de
   déplacement de code non demandé, pas de dépendance ajoutée sans justification.
6. **Exécuter les contrôles** applicables (voir `docs/QUALITY_GATES.md`).
7. **Présenter les preuves** — commandes lancées et sorties réelles.
8. **Signaler les risques résiduels** et ce qui n'a **pas** été vérifié.

Ne jamais déclarer une tâche terminée sans preuve d'exécution. Ne jamais inventer un
résultat de test, de build ou de scan.

## Commandes réelles du projet

| But | Commande |
| --- | --- |
| Installation | `pnpm install` |
| Développement (tout) | `pnpm dev` |
| Développement (une app) | `pnpm dev --filter=app` |
| Lint / format check | `pnpm lint` |
| Correction automatique | `pnpm format` |
| Typecheck | `pnpm typecheck` |
| Tests unitaires / intégration | `pnpm test` |
| Build | `pnpm build` |
| Build sans services tiers | `pnpm build --filter=app... --filter=api...` |
| Tests E2E Playwright | `pnpm e2e` (navigateurs : `pnpm e2e:install`) |
| Analyse de sécurité | `pnpm semgrep` |
| Chaîne complète locale | `pnpm verify` |
| Tests du garde-fou Bash | `pnpm test:hooks` |
| Tests des scripts d'amorçage | `pnpm test:scripts` |
| Tests du lanceur | `pnpm test:launcher` |
| Frontières Turborepo | `pnpm boundaries` |
| Graphe de dépendances | `pnpm graph` |
| Postgres local | `docker compose up -d` |
| Hook anti-push sur `main` | `pnpm hooks:install` (automatique à l'install) |
| Générer les `.env.local` manquants | `pnpm env:setup` |
| Créer un projet depuis la graine | `vibe0` (après `pnpm vibe0:install`) |
| Réinitialiser une copie du dépôt | `pnpm project:init --name <slug> [--port <n>]` |
| Migration (dev) | `pnpm migrate` |
| Migration (déploiement) | `pnpm migrate:deploy` |
| État des migrations | `pnpm migrate:status` |

Ports : `app` 3000, `web` 3001, `api` 3002, `email` 3003, `docs` 3004, `studio` 3005,
`storybook` 6006.

### Limites connues des commandes

- `pnpm build` complet nécessite `BASEHUB_TOKEN` (build de `@repo/cms`, requis par `apps/web`).
  Sans ce jeton, utiliser le filtre `--filter=app... --filter=api...`.
- Les apps exigent `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEB_URL` (les
  autres variables sont optionnelles). Une variable optionnelle laissée à `""` **échoue**
  la validation Zod : la commenter plutôt que la laisser vide.
- `pnpm e2e` exige une application démarrée et des identifiants de test ; sans cela les
  scénarios authentifiés sont ignorés (`test.skip`).
- `pnpm semgrep` exige Semgrep installé localement (`brew install semgrep` ou
  `pipx install semgrep`). En CI il tourne dans le conteneur officiel.

## Règles spécialisées

| Fichier | Portée |
| --- | --- |
| `.claude/rules/architecture.md` | `apps/**`, `packages/**`, frontières, dépendances |
| `.claude/rules/security.md` | routes, server actions, auth, permissions, webhooks |
| `.claude/rules/database.md` | Prisma, schéma, migrations, intégrité |
| `.claude/rules/quality.md` | tests, typage, définition de terminé |
| `.claude/rules/deployment.md` | CI, environnements, variables, observabilité |
| `.claude/rules/project-domain.md` | règles métier du produit (à compléter) |

## Procédures (skills)

- `/implement-change` — analyser puis implémenter un changement limité.
- `/review-change` — revue indépendante d'un diff.
- `/blind-spot-review` — recherche contradictoire des angles morts.
- `/release-readiness` — vérification avant livraison.
- `/vibe` — audit du respect des principes du projet (commande `.claude/commands/vibe.md`).
- `/next-forge` — référence du template (fournie par next-forge).

## Contribution

Tout changement passe par une branche et une pull request ; `main` ne reçoit que du code
dont la CI est verte. Procédure dans `docs/DEPLOYMENT.md`. L'échappatoire
`ALLOW_DIRECT_PUSH_MAIN=1` est réservée à la création initiale d'un dépôt.

## Interdits permanents

- Modifier la production, les données réelles ou des secrets.
- Committer une valeur secrète (même « de test ») ; seuls les `.env.example` sans valeur sont versionnés.
- Contourner un contrôle : `|| true` en CI, `@ts-ignore`, `any` de confort, test supprimé
  ou mis en `skip` pour faire passer une chaîne.
- `prisma db push` comme stratégie de déploiement, `git push --force`, `git reset --hard`
  sur du travail non sauvegardé.
- Ajouter une dépendance, écrire une migration, modifier la CI ou accéder au réseau sans
  demander confirmation.
