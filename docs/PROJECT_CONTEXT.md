# Contexte projet

## Objectif du produit

**Non défini.** Le dépôt a été initialisé le 2026-08-04 à partir du template
[next-forge](https://github.com/vercel/next-forge) v6.0.3 et ne contient aucune logique
métier propre. Ce document doit être complété par le propriétaire du produit.

À renseigner : problème résolu, proposition de valeur, critères de succès.

## Utilisateurs

**Non défini.** La structure technique impose déjà un cadre : Clerk fournit des
utilisateurs **et des organisations**, donc le produit est multi-tenant par construction.

## Périmètre actuel

Le dépôt contient le squelette technique fonctionnel de next-forge :

- application authentifiée (`apps/app`), site public (`apps/web`), API/webhooks (`apps/api`) ;
- intégrations câblées mais inertes : Clerk (auth), Stripe (paiement), Neon/Prisma (données),
  Resend (e-mail), Knock (notifications), Liveblocks (collaboration),
  PostHog/GA (analytics), Nosecone (en-têtes), Upstash (rate limit), Sentry + BetterStack
  (observabilité) ;
- un seul modèle Prisma : `Page`, stub de démonstration.

## Hors périmètre

- Toute règle métier : rien ne doit être inventé (voir `.claude/rules/project-domain.md`).
- Toute donnée réelle ou environnement de production : aucun n'existe à ce stade.

## Architecture

Monorepo Turborepo, monolithe modulaire : `apps/*` consomment `packages/*`.
Détail dans [ARCHITECTURE.md](./ARCHITECTURE.md).

## Outillage activé

| Outil | État |
| --- | --- |
| pnpm 10.31 (workspaces) | actif — gestionnaire de paquets du dépôt |
| Turborepo 2.8 | actif — `build`, `dev`, `test`, `typecheck`, `analyze` |
| TypeScript 5.9 strict | actif — 0 erreur sur 24 workspaces |
| Biome / Ultracite | actif — `pnpm lint`, `pnpm format` |
| Vitest | actif — `apps/app`, `apps/api` |
| Playwright | configuré — parcours smoke, exécution conditionnée à un serveur démarré |
| Semgrep | configuré — `pnpm semgrep`, job CI |
| GitHub Actions | actif — `.github/workflows/ci.yml` |
| Dependabot | actif — npm + github-actions (mensuel, groupé) |
| Sentry | câblé par le template, activé uniquement sur Vercel |
| Docker Compose | actif — Postgres local |
| Graphe de dépendances | `pnpm graph` — dependency-cruiser en dépendance de développement (D-007) |

## Commandes

Voir la table de `CLAUDE.md`. Les limites connues (jetons de service requis) y sont listées.

## Environnements

| Environnement | Base de données | Notes |
| --- | --- | --- |
| local | Postgres via `docker compose` | `.env.local` par app, non versionné |
| preview | à définir | données non réelles obligatoires |
| production | à définir | jamais utilisée comme environnement de test |

## Risques principaux

Voir [RISKS.md](./RISKS.md). Les plus structurants à ce jour :

1. aucun modèle métier ni invariant défini ;
2. `relationMode = "prisma"` → intégrité référentielle non garantie par la base ;
3. dépendance forte à des services tiers dont les clés ne sont pas encore provisionnées ;
4. dérive de versions du template déjà constatée (voir [DECISIONS.md](./DECISIONS.md)).
