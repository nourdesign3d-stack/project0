# Risques

Gravité : `critique` / `élevée` / `moyenne` / `faible`.
Probabilité : `haute` / `moyenne` / `basse`.
Statut : `ouvert` / `atténué` / `accepté` / `fermé`.

Les risques ci-dessous sont ceux **du squelette lui-même** : ils s'appliquent à tout
projet qui en part. Les compléter par les risques propres au produit.

| ID | Risque | Gravité | Probabilité | Contrôle en place | Propriétaire | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Aucun modèle métier ni invariant défini : tout code écrit repose sur des suppositions | élevée | haute | `.claude/rules/project-domain.md` interdit d'inventer ; `ASSUMPTIONS.md` trace les hypothèses | propriétaire produit | ouvert |
| R-002 | `relationMode = "prisma"` : aucune clé étrangère appliquée par la base — intégrité référentielle à la charge de l'application | élevée | haute | règle explicite dans `.claude/rules/database.md` + axe dédié dans `/blind-spot-review` | à désigner | ouvert |
| R-003 | **Aucune protection bot/WAF** : Arcjet ne fait pas partie du squelette ; la limitation de débit est inactive faute de clé Upstash. Toute route publique ou coûteuse est exposée à l'abus | élevée | haute | aucun contrôle automatique : les bornes sont à écrire dans le code de chaque route exposée | à désigner | ouvert |
| R-004 | Aucune politique de sauvegarde ni de restauration testée | critique | moyenne | aucune | à désigner | ouvert |
| R-005 | Dérive de versions du squelette : les dépendances en `^` finissent par dépasser les API utilisées par next-forge | moyenne | haute | Dependabot mensuel groupé + cooldown ; `pnpm verify` avant toute montée de version | à désigner | ouvert |
| R-006 | Build complet impossible sans `BASEHUB_TOKEN` : `apps/web` n'est pas couvert par la CI par défaut | moyenne | haute | job `build-full` écrit mais inactif tant que la variable de dépôt `ENABLE_FULL_BUILD` n'est pas positionnée | à désigner | ouvert |
| R-007 | Surface de dépendances large (≈20 packages, ~15 services tiers) pour un produit sans périmètre défini | moyenne | haute | hypothèse H-005 : arbitrage de suppression à faire | propriétaire produit | ouvert |
| R-008 | Aucune revue de ce qui part vers Sentry / BetterStack (fuite potentielle de donnée personnelle) | élevée | moyenne | `.claude/rules/security.md` impose le filtrage ; non implémenté | à désigner | ouvert |
| R-009 | Protection de branche non configurée sur le dépôt distant | moyenne | haute | hook `pre-push` local (`pnpm hooks:install`) ; règle serveur à appliquer selon le plan GitHub | à désigner | ouvert |

## Revue

Ce tableau est relu à chaque `/release-readiness` et à chaque `/vibe`. Un risque ne se
ferme que lorsque son contrôle est **vérifié**, pas lorsqu'il est prévu.
