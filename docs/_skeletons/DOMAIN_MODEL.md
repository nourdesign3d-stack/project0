# Modèle de domaine

> **État : à définir.** Ne rien inventer. Une règle métier non confirmée est une
> hypothèse : elle va dans [ASSUMPTIONS.md](./ASSUMPTIONS.md), pas ici.

## Acteurs

| Acteur | Source | Statut |
| --- | --- | --- |
| Utilisateur authentifié | Clerk | existe techniquement, rôle métier non défini |
| Organisation | Clerk (organizations) | existe techniquement, périmètre non défini |
| Système (webhooks, cron) | `apps/api` | existe techniquement |

Rôles internes, permissions par rôle et hiérarchie : à définir.

## Entités

| Entité | Modèle Prisma | Statut |
| --- | --- | --- |
| `WebhookEvent` | `packages/database/prisma/schema.prisma` | **infrastructure**, pas du domaine : garantit l'idempotence des webhooks. Ne pas supprimer |

## États et transitions

À remplir pour chaque entité, dès sa création :

```
Entité      : <nom>
États       : <liste exhaustive>
Transitions : <état source> --<événement>--> <état cible>  (qui a le droit, condition)
Interdits   : transitions explicitement impossibles
Terminaux   : états depuis lesquels aucune transition n'existe
```

## Règles métier

Format attendu :

```
RG-001  Énoncé de la règle
        Où elle est appliquée (fichier/fonction)
        Comment elle est protégée (contrainte BDD / vérification serveur / test)
        Conséquence si elle est violée
```

## Invariants

```
INV-001  Isolation inter-organisation
         Une donnée appartenant à une organisation n'est jamais lisible ni modifiable
         par un membre d'une autre organisation.
         Protection attendue : filtre de tenant dans chaque requête serveur + test de refus.
         Statut : à appliquer dès la première entité métier.
```

## Permissions

À définir. En attendant : refus par défaut, toute action non explicitement autorisée est
refusée côté serveur.
