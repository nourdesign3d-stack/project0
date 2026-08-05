---
description: Prisma, schéma, migrations, intégrité et récupération des données.
globs: ["packages/database/**"]
---

# Règles base de données

## État réel

- Prisma 7 (`packages/database`), provider `postgresql`, `relationMode = "prisma"`.
- Client généré dans `packages/database/generated` par `prisma generate`
  (`pnpm --filter @repo/database run build`).
- Pilote Postgres standard (`@prisma/adapter-pg`) — connexion par `DATABASE_URL`, partout.
  L'adaptateur Neon serverless a été retiré (D-021) : il parlait un protocole WebSocket
  propre à Neon et ne pouvait interroger **aucun** Postgres ordinaire — ni celui de
  `docker compose`, ni celui de la CI. Sur Neon, utiliser le point d'accès « pooler ».
- Le schéma contient un modèle de démonstration `Page`, à supprimer, et un modèle
  d'infrastructure `WebhookEvent` (idempotence, D-023) qui ne suppose rien du produit.
  Le vrai modèle métier reste à définir (`docs/DOMAIN_MODEL.md`).

⚠️ `relationMode = "prisma"` signifie que **les clés étrangères ne sont pas appliquées par
la base**. L'intégrité référentielle repose sur l'application : chaque suppression ou
réassociation doit être traitée explicitement, et les index sur les colonnes de relation
sont obligatoires.

## Migrations

- Toute évolution de schéma → migration versionnée : `pnpm migrate` (dev),
  `pnpm migrate:deploy` (déploiement), `pnpm migrate:status` (contrôle).
- `pnpm db:push` est réservé au prototypage local jetable. Interdit hors de ce cadre
  (bloqué dans `.claude/settings.json`).
- Migration progressive obligatoire quand du code tourne déjà :
  1. **expand** — ajouter la colonne/table en nullable ou avec défaut ;
  2. **backfill** — remplir par lots, idempotent, reprenable ;
  3. **migrate** — basculer le code ;
  4. **contract** — supprimer l'ancien, dans une release ultérieure.
- Une migration destructive (drop de colonne/table, changement de type non compatible)
  exige : sauvegarde vérifiée, plan de retour, validation explicite du propriétaire.
- Une migration doit être relisible : pas de SQL généré non compris, pas de suppression
  « au passage ».

## Écritures applicatives

- Écritures liées → une seule transaction (`prisma.$transaction`).
- Opérations rejouables (webhooks, jobs, retries) → **idempotentes** : clé d'idempotence
  ou contrainte d'unicité, jamais « on suppose que ça n'arrivera qu'une fois ».
- Contraintes d'unicité et index déclarés dans le schéma, pas seulement vérifiés en code
  (une vérification `findFirst` puis `create` est une course, pas une contrainte).
- Pas de `deleteMany`/`updateMany` sans filtre de tenant explicite.

## Requêtes

- Sélectionner les champs nécessaires (`select`), pas d'objet complet par défaut.
- Pagination obligatoire sur toute liste potentiellement non bornée.
- Attention aux N+1 : préférer `include`/`in` à une boucle de requêtes.

## Sauvegarde et récupération

Avant toute opération risquée sur des données : vérifier qu'une sauvegarde récente existe
et que la procédure de restauration est connue. Consigner l'état dans `docs/RISKS.md`
tant que la procédure n'a pas été testée.
