# Risques

Gravité : `critique` / `élevée` / `moyenne` / `faible`.
Probabilité : `haute` / `moyenne` / `basse`.
Statut : `ouvert` / `atténué` / `accepté` / `fermé`.

| ID | Risque | Gravité | Probabilité | Contrôle en place | Propriétaire | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Aucun modèle métier ni invariant défini : tout code écrit maintenant repose sur des suppositions | élevée | haute | `.claude/rules/project-domain.md` interdit d'inventer ; `ASSUMPTIONS.md` trace les hypothèses | propriétaire produit | ouvert |
| R-002 | `relationMode = "prisma"` : aucune clé étrangère appliquée par la base — intégrité référentielle à la charge de l'application | élevée | haute | règle explicite dans `.claude/rules/database.md` + axe dédié dans `/blind-spot-review` | à désigner | ouvert |
| R-003 | Aucune clé de service provisionnée : Arcjet (WAF/bot) et rate-limit sont **inactifs** | élevée | haute | aucun | à désigner | ouvert |
| R-004 | Aucune politique de sauvegarde ni de restauration testée | critique | moyenne | aucune | à désigner | ouvert |
| R-005 | Dérive de versions du template : les dépendances en `^` ont dépassé les API utilisées par next-forge 6.0.3 (Clerk Core 3, AI SDK v6, Knock, Stripe agent toolkit, recharts 3, react-resizable-panels 4) | moyenne | **avérée** | corrections appliquées, `pnpm typecheck` à 0 erreur, Dependabot mensuel groupé | à désigner | atténué |
| R-006 | Corrections de dérive non validées à l'exécution (aucune clé de service pour tester Clerk/Stripe/IA) | moyenne | moyenne | consignées dans `DECISIONS.md`, hypothèse H-007 | à désigner | ouvert |
| R-007 | `pnpm build` complet impossible sans `BASEHUB_TOKEN` : `apps/web` n'est pas couvert par la CI par défaut | moyenne | haute | job `build-full` conditionnel documenté dans `DEPLOYMENT.md` | à désigner | atténué |
| R-008 | Playwright configuré mais aucun parcours réellement exécuté (application non démarrable sans clés) | moyenne | haute | smoke tests écrits, `test.skip` explicite, job CI conditionnel | à désigner | ouvert |
| R-009 | Surface de dépendances très large (≈20 packages, ~15 services tiers) pour un produit sans périmètre défini | moyenne | haute | hypothèse H-006 : arbitrage de suppression à faire | propriétaire produit | ouvert |
| R-010 | Aucune revue de ce qui part vers Sentry / BetterStack (fuite potentielle de donnée personnelle) | élevée | moyenne | `.claude/rules/security.md` impose le filtrage ; non implémenté | à désigner | ouvert |
| R-011 | Branche principale sans protection (dépôt local, aucun remote configuré) | moyenne | haute | procédure décrite dans `DEPLOYMENT.md` ; à appliquer à la création du remote | à désigner | ouvert |

## Revue

Ce tableau est relu à chaque `/release-readiness` et à chaque `/vibe`. Un risque ne se
ferme que lorsque son contrôle est **vérifié**, pas lorsqu'il est prévu.
