# Modèle de domaine

> **État : à définir.** Rien n'est inventé ici. Le dépôt ne contient aucune règle métier.

## Acteurs

| Acteur | Source | Statut |
| --- | --- | --- |
| Utilisateur authentifié | Clerk | existe techniquement, rôle métier non défini |
| Organisation | Clerk (organizations) | existe techniquement, périmètre non défini |
| Système (webhooks, cron) | `apps/api` | existe techniquement |

Rôles internes, permissions par rôle et hiérarchie : **non définis**.

## Entités

| Entité | Modèle Prisma | Statut |
| --- | --- | --- |
| `Page` | `packages/database/prisma/schema.prisma` | **stub de démonstration**, à supprimer dès qu'un vrai modèle existe |

Aucune autre entité persistée.

## États et transitions

Aucun cycle de vie défini.

Modèle à remplir pour chaque entité, dès sa création :

```
Entité      : <nom>
États       : <liste exhaustive>
Transitions : <état source> --<événement>--> <état cible>  (qui a le droit, condition)
Interdits   : transitions explicitement impossibles
Terminaux   : états depuis lesquels aucune transition n'existe
```

## Règles métier

Aucune. Toute règle ajoutée doit être consignée ici **et** protégée par un test.

Format attendu :

```
RG-001  Énoncé de la règle
        Où elle est appliquée (fichier/fonction)
        Comment elle est protégée (contrainte BDD / vérification serveur / test)
        Conséquence si elle est violée
```

## Invariants

Un seul invariant est établi, par construction technique :

```
INV-001  Isolation inter-organisation
         Une donnée appartenant à une organisation n'est jamais lisible ni modifiable
         par un membre d'une autre organisation.
         Protection attendue : filtre de tenant dans chaque requête serveur + test de refus.
         Statut : à appliquer dès la première entité métier.
```

## Permissions

Non définies. En attendant, appliquer le refus par défaut : toute action non explicitement
autorisée est refusée côté serveur.
