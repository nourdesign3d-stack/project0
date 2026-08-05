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
| R-007 | `pnpm build` complet impossible sans `BASEHUB_TOKEN` : `apps/web` n'est **pas** couvert par la CI | moyenne | haute | job `build-full` écrit mais **inactif** : la variable de dépôt `ENABLE_FULL_BUILD` n'est pas positionnée | à désigner | **ouvert** |
| R-008 | Parcours **authentifié** non couvert : aucun compte de test fourni (`E2E_USER_EMAIL`/`E2E_USER_PASSWORD`) | moyenne | haute | aucun — les 4 tests anonymes exécutés ne couvrent pas ce chemin ; le saut est explicite, jamais silencieux | à désigner | **ouvert** |
| R-009 | Surface de dépendances très large (≈20 packages, ~15 services tiers) pour un produit sans périmètre défini | moyenne | haute | hypothèse H-006 : arbitrage de suppression à faire | propriétaire produit | ouvert |
| R-010 | Aucune revue de ce qui part vers Sentry / BetterStack (fuite potentielle de donnée personnelle) | élevée | moyenne | `.claude/rules/security.md` impose le filtrage ; non implémenté | à désigner | ouvert |
| R-011 | `main` sans protection **côté serveur** : dépôt privé sur plan GitHub gratuit, branches protégées et rulesets refusés (403). Une fusion sans CI verte reste techniquement possible | moyenne | moyenne | hook `pre-push` local versionné (`.githooks/`, `pnpm hooks:install`) refusant les pushs directs — contournable, ne remplace pas une règle serveur ; règle serveur prête à appliquer (DEPLOYMENT.md) | propriétaire du dépôt | **accepté** (décision du 2026-08-05 : rester privé sans plan payant) |
| R-012 | Webhooks non idempotents : un événement Clerk ou Stripe rejoué est traité plusieurs fois (analytics faussées, effets de bord dupliqués) | moyenne | haute | signature vérifiée et testée ; **aucune mémorisation des événements traités** — exige un modèle de données que la graine n'a pas encore | à désigner | ouvert |
| R-013 | `apps/app/proxy.ts` n'appelle pas `auth.protect()` : toute route ajoutée hors du layout authentifié est publique | élevée | moyenne | documenté dans ARCHITECTURE.md et SECURITY_MODEL.md ; décision reportée faute de clés Clerk pour vérifier le comportement | à désigner | ouvert |
| R-014 | 30 alertes de vulnérabilité à l'activation (8 hautes), dont 41 occurrences sur `next` 16.1.6 corrigées en 16.2.6 | élevée | avérée | alertes activées le 2026-08-05 ; règle de tri dans `DEPLOYMENT.md` ; **aucune montée de version encore effectuée** | à désigner | ouvert |

## Revue

Ce tableau est relu à chaque `/release-readiness` et à chaque `/vibe`. Un risque ne se
ferme que lorsque son contrôle est **vérifié**, pas lorsqu'il est prévu.
