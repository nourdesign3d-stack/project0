# Risques

Gravité : `critique` / `élevée` / `moyenne` / `faible`.
Probabilité : `haute` / `moyenne` / `basse`.
Statut : `ouvert` / `atténué` / `accepté` / `fermé`.

| ID | Risque | Gravité | Probabilité | Contrôle en place | Propriétaire | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Aucun modèle métier ni invariant défini : tout code écrit maintenant repose sur des suppositions | élevée | haute | `.claude/rules/project-domain.md` interdit d'inventer ; `ASSUMPTIONS.md` trace les hypothèses | propriétaire produit | ouvert |
| R-002 | `relationMode = "prisma"` : aucune clé étrangère appliquée par la base — intégrité référentielle à la charge de l'application | élevée | haute | règle explicite dans `.claude/rules/database.md` + axe dédié dans `/blind-spot-review` | à désigner | ouvert |
| R-003 | **Aucune protection bot/WAF** : Arcjet retiré (D-014), limitation de débit inactive faute de clé Upstash. Une route publique coûteuse est exposée à l'abus | élevée | haute | aucun contrôle automatique ; bornes à écrire dans le code de chaque route exposée | à désigner | **ouvert, assumé** |
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
| R-014 | 69 alertes de vulnérabilité ouvertes (271 fermées) : 32 `hono`, 12 `undici`, le reste transitif | moyenne | avérée | règle de tri dans `DEPLOYMENT.md` ; passe mensuelle avec les PR Dependabot | à désigner | ouvert |
| R-015 | `trustPolicy: no-downgrade` a écarté quatre paquets en une semaine : il refuse aussi des correctifs de sécurité légitimes, et rend `pnpm dedupe` inutilisable sur cet arbre | moyenne | avérée | une exception nommée et datée (`chokidar`) dans `pnpm-workspace.yaml` ; les trois autres cas ont été résolus par retrait ou montée de version | à désigner | ouvert |
| R-016 | Le garde-fou Bash **n'est pas une frontière de sécurité** : il a été contourné par 8 formulations sur 11 lors de l'audit du 2026-08-05 (guillemets, `sh -c`, traversée de chemin, variable, redirection). Corrigé et gardé par 60 cas, mais un obfuscateur déterminé passera | moyenne | haute | 60 cas de test dont les 10 contournements de l'audit ; limite écrite dans l'en-tête du hook | à désigner | **accepté** |
| R-017 | `project:init` ne nettoie les résidus du projet source **que si le nom change**. Une copie brute vers un dossier de même nom conserve les `.env.local` hérités ; les `.turbo`/`.next` par workspace survivent dans tous les cas | élevée | moyenne | `git clone` prescrit à la place de la copie ; test de régression sur le cas renommé uniquement | à désigner | ouvert |

## Revue

Ce tableau est relu à chaque `/release-readiness` et à chaque `/vibe`. Un risque ne se
ferme que lorsque son contrôle est **vérifié**, pas lorsqu'il est prévu.
