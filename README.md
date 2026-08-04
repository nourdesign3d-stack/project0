# project0

Monorepo Turborepo basé sur [next-forge](https://github.com/vercel/next-forge) v6
(Next.js 16, React 19, TypeScript 5.9, Prisma 7, pnpm 10).

> Le produit n'a pas encore de périmètre métier défini : voir
> [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md).

## Démarrer

```bash
pnpm install
pnpm hooks:install             # garde-fou : pas de push direct sur main
docker compose up -d           # Postgres local (port réglé dans .env)
cp apps/app/.env.example apps/app/.env.local   # puis renseigner les variables
pnpm dev
```

Variables réellement requises : `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_WEB_URL`. Une variable optionnelle laissée à `""` échoue la validation :
la commenter. Détail dans [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

Ports : `app` 3000 · `web` 3001 · `api` 3002 · `email` 3003 · `docs` 3004 ·
`studio` 3005 · `storybook` 6006.

## Commandes

| But | Commande |
| --- | --- |
| Lint / format | `pnpm lint` · `pnpm format` |
| Typecheck | `pnpm typecheck` |
| Tests | `pnpm test` |
| Build | `pnpm build` (complet) · `pnpm build --filter=app... --filter=api...` |
| E2E | `pnpm e2e` (navigateurs : `pnpm e2e:install`) |
| Sécurité statique | `pnpm semgrep` |
| Chaîne complète | `pnpm verify` |
| Graphe de dépendances | `pnpm graph` |
| Frontières | `pnpm boundaries` |
| Migrations | `pnpm migrate` · `pnpm migrate:deploy` · `pnpm migrate:status` |

`pnpm build` complet nécessite `BASEHUB_TOKEN` (build de `@repo/cms`, requis par `apps/web`).

## Structure

```
apps/       app · web · api · email · docs · studio · storybook
packages/   auth · database · design-system · observability · security · payments · …
docs/       connaissance du projet (architecture, sécurité, décisions, risques)
e2e/        tests Playwright des parcours critiques
.claude/    règles, procédures et réglages pour les agents
```

Détail des responsabilités : [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Intégrations fournies par le template

Clerk (authentification), Prisma + Neon (données), Stripe (paiement), BaseHub (CMS),
Resend (e-mail), Knock (notifications), Liveblocks (collaboration), PostHog / Google
Analytics, Arcjet + Nosecone (sécurité), Upstash (limitation de débit), Svix (webhooks
sortants), Sentry + BetterStack (observabilité), Vercel Blob (stockage).

Toutes sont **câblées mais inertes** tant que leurs clés ne sont pas fournies.

## Repartir de ce dépôt pour un autre projet

Le dépôt ne contient plus d'identifiant en dur : les règles Semgrep, le hook, le nom des
conteneurs Docker et le graphe sont neutres. Seuls le nom du paquet racine et le titre de
ce README portent le nom du projet, et ils sont écrits par un script.

```bash
cp -R <ce-dossier> ../mon-projet          # sans node_modules ni .next
cd ../mon-projet
pnpm project:init --name mon-projet --port 5433
```

`project:init` inscrit le nom, remet les **six documents « journal »** de `docs/` à leur
squelette (`docs/_skeletons/`), écrit le `.env` de Docker Compose et supprime le graphe
généré. Il ne touche ni à Git, ni au code, ni aux dépendances : les étapes restantes sont
affichées à la fin.

Les quatre autres documents (`ARCHITECTURE`, `SECURITY_MODEL`, `QUALITY_GATES`,
`DEPLOYMENT`) décrivent le squelette et sont **conservés** — à relire, pas à vider.
Détail de la répartition : [`docs/_skeletons/README.md`](./docs/_skeletons/README.md).

⚠️ Ce que cette copie n'apporte pas : les correctifs de dérive amont sont figés par
`pnpm-lock.yaml`. Une montée de version (`pnpm bump-deps`, `next-forge update`) rouvrira
ce chantier. Lancer `pnpm verify` après toute mise à jour.

## Contribuer

Lire d'abord [`AGENTS.md`](./AGENTS.md) (principes non négociables) et
[`CLAUDE.md`](./CLAUDE.md) (boucle de travail et commandes).

Contrôles obligatoires selon le type de changement :
[`docs/QUALITY_GATES.md`](./docs/QUALITY_GATES.md).

## Documentation

| Document | Contenu |
| --- | --- |
| [PROJECT_CONTEXT](./docs/PROJECT_CONTEXT.md) | objectif, périmètre, outillage, environnements |
| [ARCHITECTURE](./docs/ARCHITECTURE.md) | applications, packages, flux, frontières |
| [DOMAIN_MODEL](./docs/DOMAIN_MODEL.md) | acteurs, entités, règles métier (à définir) |
| [DATA_DICTIONARY](./docs/DATA_DICTIONARY.md) | données, sensibilité, conservation |
| [SECURITY_MODEL](./docs/SECURITY_MODEL.md) | actifs, menaces, contrôles |
| [QUALITY_GATES](./docs/QUALITY_GATES.md) | contrôles par type de changement |
| [DEPLOYMENT](./docs/DEPLOYMENT.md) | CI, variables, migrations, récupération |
| [ASSUMPTIONS](./docs/ASSUMPTIONS.md) | hypothèses en attente de validation |
| [RISKS](./docs/RISKS.md) | risques connus et leur statut |
| [DECISIONS](./docs/DECISIONS.md) | décisions structurantes et justifications |

## Amont

Le template next-forge est maintenu par Vercel sous licence MIT.
Mise à jour du template : `npx next-forge@latest update` (à relire, la dérive de versions
est réelle — voir [`docs/DECISIONS.md`](./docs/DECISIONS.md)).
