# Contexte projet

> À compléter par le propriétaire du produit. Ne rien inventer : une case inconnue reste
> marquée « non défini » jusqu'à ce qu'une réponse existe.

## Objectif du produit

Non défini. À renseigner : problème résolu, proposition de valeur, critères de succès.

## Utilisateurs

Non défini.

Contrainte déjà imposée par le squelette : Clerk fournit des utilisateurs **et des
organisations**, donc le produit est multi-tenant par construction tant que
`packages/auth` n'est pas remplacé.

## Périmètre actuel

Squelette next-forge : `apps/app` (application authentifiée), `apps/web` (site public),
`apps/api` (webhooks, cron, health), plus `email`, `docs`, `studio`, `storybook`.
Intégrations câblées mais inertes tant que leurs clés ne sont pas fournies.

Aucune logique métier.

## Hors périmètre

- Toute règle métier non écrite dans `DOMAIN_MODEL.md`.
- Toute donnée réelle tant qu'aucun environnement n'est défini.

## Architecture

Monorepo Turborepo, monolithe modulaire. Voir [ARCHITECTURE.md](./ARCHITECTURE.md).

## Outillage activé

Voir [DEPLOYMENT.md](./DEPLOYMENT.md) et la table de commandes du `README.md`.
Consigner ici tout outil ajouté ou retiré par rapport au squelette.

## Environnements

| Environnement | Base de données | Notes |
| --- | --- | --- |
| local | Postgres via `docker compose` | `.env.local` par app, non versionné |
| preview | à définir | données non réelles obligatoires |
| production | à définir | jamais utilisée comme environnement de test |

## Risques principaux

Voir [RISKS.md](./RISKS.md).
