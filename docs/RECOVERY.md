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

## Ce qui reste à décider

Ces points n'ont pas de bonne réponse générique — ils dépendent de ce que le produit peut
se permettre de perdre. Tant qu'ils ne sont pas tranchés, R-004 reste ouvert.

| Décision | Question à trancher |
| --- | --- |
| Fréquence | quelle quantité de données peut-on perdre (RPO) ? |
| Rétention | combien de temps garde-t-on les sauvegardes, et où ? |
| Emplacement | une sauvegarde sur la même machine que la base ne protège de rien |
| Délai de reprise | en combien de temps doit-on être revenu en service (RTO) ? |
| Responsable | qui vérifie que les sauvegardes existent et qui répète la restauration ? |
| Fréquence de répétition | une procédure non rejouée redevient non testée |

Voir `docs/ASSUMPTIONS.md` (H-008) et `docs/RISKS.md` (R-004).
