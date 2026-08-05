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
| R-014 | 60 alertes de vulnérabilité ouvertes (280 fermées) : 32 `hono`, 12 `undici`, le reste transitif, 0 sur `next` | moyenne | avérée | règle de tri dans `DEPLOYMENT.md` ; `overrides` Next dans `pnpm-workspace.yaml` (D-016) ; passe mensuelle avec les PR Dependabot | à désigner | ouvert |
| R-015 | `trustPolicy: no-downgrade` a écarté quatre paquets en une semaine : il refuse aussi des correctifs légitimes, et rend `pnpm dedupe` inutilisable sur cet arbre | moyenne | avérée | une exception nommée (`chokidar`) **avec échéance au 2026-11-05** dans `pnpm-workspace.yaml` ; relecture rappelée par `/vibe` | à désigner | ouvert |
| R-016 | Le garde-fou Bash **n'est pas une frontière de sécurité** : deux audits successifs l'ont contourné (8/11 puis 16 formulations). Réécrit sur tokenisation ; un obfuscateur déterminé passera toujours (encodage, variable construite) | moyenne | haute | 85 cas de test couvrant les contournements des deux audits et les faux positifs ; limite écrite dans l'en-tête du hook | à désigner | **accepté** |
| R-017 | Résidus d'une copie de dossier : environnements hérités, instance Clerk, caches de build | élevée | moyenne | `git clone` prescrit ; `project:init` supprime toujours les caches (racine **et** par workspace) ; à nom changé il régénère les environnements, à nom égal il **refuse** et explique (`--fresh` / `--keep-env`) ; 4 cas de test dont le refus | à désigner | **atténué** |
| R-018 | Sentry bridé : sans variables locales ni corps de requête, une erreur de validation n'est plus reproductible depuis Sentry seul | moyenne | moyenne | contrepartie assumée pour ne pas exfiltrer de donnée personnelle ; compensation attendue au cas par cas (identifiant de corrélation + forme de l'erreur, jamais la valeur) — inscrite dans `.claude/rules/security.md`, **non implémentée** faute de frontière métier | à désigner | ouvert |

## Revue

Ce tableau est relu à chaque `/release-readiness` et à chaque `/vibe`. Un risque ne se
ferme que lorsque son contrôle est **vérifié**, pas lorsqu'il est prévu.
