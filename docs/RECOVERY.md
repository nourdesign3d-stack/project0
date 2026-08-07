# Sauvegarde et restauration

> **État au 2026-08-05** : la procédure ci-dessous a été **exécutée**, pas seulement écrite.
> Ce qui reste à décider est isolé en fin de document — ce sont des décisions de
> propriétaire, pas des commandes.

Une sauvegarde jamais restaurée n'est pas une sauvegarde. C'est le seul incident dont
aucun correctif ne rattrape : on ne redéploie pas des données perdues.

## Les deux commandes

```bash
pnpm db:backup                      # sauvegarde ce que désigne DATABASE_URL
pnpm db:restore <fichier> --to local --yes
```

`pg_dump` et `pg_restore` sont exécutés **dans le conteneur** de `compose.yml`. Deux
raisons : aucun client Postgres à installer sur chaque poste, et surtout aucun risque de
client plus ancien que le serveur — `pg_dump` refuse de sauvegarder une base plus récente
que lui.

L'URL n'apparaît jamais à l'écran ni dans une ligne de commande : elle passe par
l'environnement du conteneur. Les scripts n'affichent que l'hôte et le nom de la base.

## Répétition exécutée le 2026-08-05

Restaurer **ailleurs** que sur la source : c'est la seule répétition qui prouve la
sauvegarde sans mettre en jeu ce qu'elle protège.

| Étape | Résultat |
| --- | --- |
| `pnpm db:backup` depuis une base **Neon** (via le pooler) | 4124 octets, permissions `600` |
| Suppression de `Page` et `_prisma_migrations` sur la base locale | `DROP TABLE` |
| `pnpm db:restore <dump> --to local --yes` | terminée sans erreur |
| Contrôle | les deux tables et la migration `20260805135910_init` sont revenues |

### Ce que la répétition a corrigé

Le premier essai a signalé « Restauration échouée » alors que **tout était restauré**.
`pg_dump` d'une base Neon emporte des privilèges propres à l'hébergeur
(`GRANT ... TO neon_superuser`) que toute autre base refuse ; `pg_restore` sort alors en
erreur pour deux instructions ignorées, sur un travail par ailleurs réussi.

Deux corrections : `--no-owner --no-acl` retire ces privilèges du dump, et le message
d'échec distingue désormais « échec complet » de « instruction ignorée ». Un faux négatif
est ici plus dangereux qu'un vrai échec — en incident, il pousse à renoncer à une
restauration pourtant valide.

## Garde-fous

- La cible est **explicite** : `--to local` ou `--to database-url`, jamais de défaut.
  `database-url` peut désigner la production ; se tromper de cible, c'est écraser ce qu'on
  voulait sauver.
- `--yes` est obligatoire, après affichage de l'hôte et de la base visés.
- `db:backup` **refuse d'écraser** une sauvegarde existante.
- Les fichiers de sauvegarde sont en `600` et `sauvegardes/` est ignoré par Git : un dump
  contient l'intégralité des données, il se protège comme un secret.

## Contrôler une restauration

Ne jamais conclure sur le seul code de sortie :

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c '\dt'
```

Puis vérifier le nombre de lignes des tables qui comptent, et l'historique des migrations
(`_prisma_migrations`).

## Restauration ponctuelle chez l'hébergeur

Neon conserve un historique permettant de restaurer à un instant donné, et de créer une
**branche** à partir d'un point du passé — souvent préférable à un dump : plus fin, et sans
interrompre la base courante. La rétention dépend du forfait, et **n'a pas été mesurée**.

Un dump reste nécessaire malgré cela : il survit à la perte du compte chez l'hébergeur, ce
qu'aucune fonction interne à cet hébergeur ne peut faire.

## Politique de sauvegarde

**Décidée le 2026-08-07** par le propriétaire du produit. Elle ferme R-004 et retire
H-008.

Deux régimes, parce que la tolérance change radicalement le jour où des données ne vous
appartiennent plus.

| | **Avant le premier utilisateur réel** | **Dès le premier client** |
| --- | --- | --- |
| **RPO** — perte de données acceptable | 24 h | **1 h** |
| **RTO** — indisponibilité acceptable | 24 h | **4 h** |
| Fréquence | 1 sauvegarde par jour | historique PITR **+** 1 sauvegarde par jour |
| Rétention | 30 jours | 30 jours glissants **+** 1 mensuelle gardée 12 mois |
| Emplacement | **hors de l'hébergeur de la base** | **hors de l'hébergeur de la base** |
| Répétition de restauration | 1 fois par trimestre | 1 fois par trimestre |
| Responsable | propriétaire du produit | propriétaire du produit |

### Ce qui compte le plus n'est pas un chiffre

**L'emplacement.** Une sauvegarde qui vit chez le même hébergeur que la base ne protège
que d'une erreur de manipulation. Elle ne protège pas de la perte du compte — facturation
impayée, suspension, compromission des identifiants de l'hébergeur. Il faut une copie
ailleurs : un autre fournisseur de stockage, ou un disque chiffré au début.

**Le PITR n'est pas une sauvegarde**, c'est un historique. Excellent pour rattraper une
suppression accidentelle à 14 h 03 ; inutile si le compte disparaît. Les deux sont
complémentaires, jamais interchangeables.

⚠️ **C'est la rétention d'historique du plan qui fixe réellement le RPO**, pas l'intention
écrite ici. Un RPO d'1 h avec une sauvegarde quotidienne n'est tenable que si le PITR
couvre l'intervalle. Vérifier la fenêtre offerte par le plan **avant** de s'engager sur ce
chiffre : quelques heures sur les offres gratuites, plusieurs jours au-delà.

### Mise en place

1. **Vérifier la fenêtre PITR du plan** de l'hébergeur de base. Si elle est inférieure au
   RPO visé, le RPO réel est celui du plan — corriger ce document plutôt que d'y croire.
2. **Choisir l'emplacement hors hébergeur** et le noter ici.
3. **Automatiser la sauvegarde quotidienne** : `pnpm db:backup` produit un fichier en
   `600`. L'automatisation (tâche planifiée, exécution CI dédiée) doit y ajouter le
   transfert vers l'emplacement choisi — sans quoi la sauvegarde reste sur la machine qui
   la produit.
4. **Poser une alerte d'échec.** Une sauvegarde qui échoue en silence est pire que pas de
   sauvegarde : elle donne l'assurance sans le contenu. C'est le point le plus souvent
   oublié.
5. **Inscrire la première répétition à l'agenda** — trimestrielle, procédure ci-dessus,
   restauration **ailleurs** que sur la source.

### État de la mise en place

| Étape | État |
| --- | --- |
| Mécanisme (`db:backup` / `db:restore`) | **fait et éprouvé** (D-027) |
| Politique (chiffres ci-dessus) | **décidée le 2026-08-07** |
| Vérification de la fenêtre PITR | **à faire** |
| Emplacement hors hébergeur | **à choisir** |
| Automatisation quotidienne | **à faire** |
| Alerte d'échec | **à faire** |
| Première répétition trimestrielle | **à planifier** |

Tant que les cinq dernières lignes ne sont pas faites, **la politique existe mais n'est
pas appliquée** — et il faut le dire ainsi, pas se contenter d'avoir écrit les chiffres.
Suivi : R-004.
