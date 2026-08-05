# Décisions

Journal des décisions structurantes. Format : contexte → décision → conséquences.

---

## D-001 — Base de code : next-forge v6.0.3, gestionnaire pnpm

**Date** : 2026-08-04
**Contexte** : dépôt vide ; besoin d'une base Next.js production-ready.
**Décision** : `npx next-forge@6.0.3 init --package-manager pnpm`, contenu déplacé à la
racine de `Project0`. Le paquet racine est renommé `project0`, passé en `private: true`,
et débarrassé de la tuyauterie de publication du template (`bin`, `files`, `publishConfig`,
script `release`, `scripts/*.ts` de la CLI, `tsup.config.ts`, `.autorc`).
**Conséquences** : plus aucun risque de `npm publish` accidentel ; les mises à jour du
template se font via `npx next-forge@latest update`, pas via les scripts locaux.

---

## D-002 — Clerk : migration `appearance.layout` → `appearance.options`

**Date** : 2026-08-04
**Contexte** : `packages/auth/provider.tsx` ne compilait pas — `@clerk/nextjs` 7.6.5
(Clerk Core 3) a supprimé `appearance.layout` et `appearance.baseTheme`, alors que le
template typait ces objets via le paquet `@clerk/types` v4, resté sur l'ancienne API.
**Décision** : typer l'objet d'apparence à partir de `ComponentProps<typeof ClerkProvider>`
(donc à partir de la version réellement installée), et renommer `layout` → `options`,
`baseTheme` → `theme`.
**Conséquences** : la dépendance `@clerk/types` n'est plus utilisée pour ce fichier ;
le comportement (liens Privacy/Terms/Help) **n'a pas pu être vérifié à l'exécution**
faute de clés Clerk → hypothèse H-007, risque R-006.

---

## D-003 — Stripe Agent Toolkit : dépendance retirée

**Date** : 2026-08-04
**Contexte** : `@stripe/agent-toolkit` 0.9 avait d'abord été corrigé (retrait de
`configuration.actions`, supprimé par l'amont : les outils exposés proviennent désormais
des permissions de la clé Stripe). Ensuite, l'activation de `trustPolicy: no-downgrade`
côté pnpm a bloqué l'installation : `@langchain/core@0.3.80`, dépendance transitive du
toolkit, présente une régression de preuve de publication (`ERR_PNPM_TRUST_DOWNGRADE`).
**Décision** : supprimer `packages/payments/ai.ts` et la dépendance
`@stripe/agent-toolkit`. Le module n'était importé par aucune application ; il apportait
LangChain, le SDK OpenAI et le SDK MCP à la surface d'attaque pour une fonctionnalité
inutilisée. Le contrôle de chaîne d'approvisionnement est conservé.
**Conséquences** : réversible par `pnpm --filter @repo/payments add @stripe/agent-toolkit`
si la fonctionnalité devient nécessaire — il faudra alors traiter l'alerte de confiance
et restreindre le périmètre par une **clé Stripe restreinte**, plus par le code.
`stripe` (SDK principal) reste installé et intact.

---

## D-004 — AI SDK v6 : mise à jour de `@repo/ai`

**Date** : 2026-08-04
**Contexte** : `ai` v6 a supprimé l'export `Message` (remplacé par `UIMessage` porteur de
`parts`), le sous-chemin `ai/react`, et l'option `compatibility` du provider OpenAI.
**Décision** : `components/message.tsx` lit `parts` ; `lib/react.ts` (réexport de
`ai/react`) est **supprimé** — `@ai-sdk/react` n'est pas une dépendance du dépôt et
`@repo/ai` n'est consommé par aucune app ; `lib/models.ts` annote explicitement les
modèles (TS2742) et utilise `openai.textEmbeddingModel(...)` pour l'embedding.
**Conséquences** : si un jour une app a besoin de `useChat`, ajouter `@ai-sdk/react`
explicitement. Package non testé à l'exécution (aucune clé OpenAI).

---

## D-005 — Design system : régénération de `chart` et `resizable`

**Date** : 2026-08-04
**Contexte** : les composants shadcn livrés par le template étaient écrits pour recharts 2
et react-resizable-panels 2/3, alors que les dépendances installées sont recharts 3 et
react-resizable-panels 4 (30 erreurs de typage).
**Décision** : régénérer par l'outil officiel (`shadcn add chart resizable --overwrite`)
plutôt que corriger à la main ou rétrograder les dépendances. Les stories Storybook
correspondantes ont été adaptées à la nouvelle API (`orientation`, `onLayoutChanged`).
**Conséquences** : `components/ui/card.tsx` a également été régénéré (dépendance de
`chart`). Le rendu visuel n'a pas été vérifié — Storybook n'a pas été lancé.

---

## D-006 — Typecheck : tâche Turborepo dédiée, indépendante du build

**Date** : 2026-08-04
**Contexte** : `pnpm typecheck` n'existait pas au niveau racine ; faire dépendre le
typecheck de `^build` entraînait le build de `@repo/cms`, qui exige `BASEHUB_TOKEN`.
**Décision** : tâche `typecheck` dans `turbo.json` dépendant uniquement de
`@repo/database#build` (génération du client Prisma). Retrait des scripts `typecheck`
de `packages/typescript-config`, `apps/studio` et `apps/email` (aucune source TS),
ajout du `tsconfig.json` manquant de `packages/rate-limit`, désactivation de
`declaration` dans `apps/storybook` (app jamais publiée, TS2742 sur des types Radix
transitifs).
**Conséquences** : `pnpm typecheck` couvre 24 workspaces sans jeton externe, **0 erreur**.

---

## D-007 — Outil de graphe : dependency-cruiser à la demande

**Date** : 2026-08-04
**Contexte** : la demande mentionnait « Graphify ou Code Review Graph ». Vérification faite :
le paquet npm `graphify` est un générateur de graphes aléatoires sans rapport, et
`code-review-graph` n'existe pas au registre. Aucun outil officiel identifiable.
**Décision** : ne pas installer d'outil non vérifiable. Utiliser **dependency-cruiser**
installé en dépendance de développement (l'exécution via `pnpm dlx` a été abandonnée :
isolée du dépôt, elle ne voyait pas TypeScript et ne cruisait que 9 modules sur 320),
configuré par `.dependency-cruiser.cjs`,
sortie Mermaid dans `docs/graph/`. `pnpm boundaries` (Turborepo) reste le contrôle rapide.
**Conséquences** : `pnpm graph` est reproductible et documenté. Si un outil « Graphify »
officiel est identifié plus tard, cette décision est à revoir — on ne conservera qu'un
seul outil de graphe.

---

## D-013 — Suites de l'audit indépendant : ce qui est corrigé, ce qui est reporté

**Date** : 2026-08-05
**Contexte** : un audit externe a rendu un verdict « NON UTILISABLE » sur trois failles
(protections agent contournables, données personnelles journalisées, cron public en
écriture). Les trois ont été vérifiées et corrigées (voir commit `656f036`). Restaient
cinq constats de niveau IMPORTANT, dont deux engagent l'architecture.

**Décision — corrigé maintenant**, parce que mesurable et vérifiable sans clés de service :

- autorisation **avant** l'accès aux données dans les deux pages authentifiées, avec un
  rappel du filtre de tenant à ajouter dès que `Page` deviendra une entité métier ;
- validation Zod aux frontières serveur : formulaire de contact public (nom, e-mail,
  message bornés), recherche d'utilisateurs, récupération d'utilisateurs ;
- tests de refus des frontières publiques : 4 cas sur le cron, 4 sur le webhook Clerk —
  dont un test qui échoue si le corps de l'événement réapparaît dans les journaux ;
- composants shadcn **réintégrés à l'analyse Semgrep**. Mesuré : 0 constat sur 452 cibles,
  donc aucune raison de les exclure. Ils restent hors du lint Biome : 669 écarts de style,
  tous écrasés au prochain `pnpm bump-ui`. Sécurité et style ne se traitent pas pareil,
  et les deux exclusions portent désormais la mesure en commentaire.

**Décision — reporté explicitement**, parce que non vérifiable en l'état :

- **idempotence des webhooks** (R-012) : elle exige de mémoriser les identifiants traités,
  donc un modèle Prisma et une migration. Livrer une table que tout projet hériterait sans
  l'avoir choisie, avant même qu'un modèle métier existe, est le contraire de ce que fait
  cette graine. À traiter au premier projet qui consomme réellement des webhooks.
- **`auth.protect()` dans le proxy** (R-013) : sans clés Clerk, impossible de constater le
  comportement réel. Trois routes doivent rester joignables
  (`/.well-known/vercel/flags`, `/api/collaboration/auth`, `/sign-in`) : une liste
  d'exclusions écrite à l'aveugle casserait le produit ou donnerait une fausse sécurité.
  La documentation dit désormais franchement que le proxy ne protège rien.

**Conséquences** : les deux reports sont inscrits dans `RISKS.md` avec leur cause et leur
condition de levée, plutôt que dissimulés dans du code non exécuté.

---

## D-012 — Démarrage d'une copie : plomberie automatisée, décisions laissées à l'humain

**Date** : 2026-08-05
**Contexte** : après neutralisation des identifiants (D-011), un clone exigeait encore
plusieurs manipulations non documentées, toutes découvertes à la main pendant
l'initialisation : créer les `.env.local`, commenter les variables vides (une variable
optionnelle à `""` échoue la validation Zod), renseigner `DATABASE_URL`, activer les
hooks Git. Un défaut réel a été trouvé en vérifiant : **aucune commande Prisma ne
fonctionnait** — Prisma 7 ne charge plus les fichiers `.env` lorsqu'un `prisma.config.ts`
existe, donc `migrate`, `migrate:deploy`, `migrate:status` et `db:push` échouaient tous
sur « Connection url is empty ».
**Décision** :
- `scripts/setup-env.mjs` (`pnpm env:setup`) génère les `.env.local` manquants depuis les
  `.env.example`, commente les variables sans valeur et renseigne `DATABASE_URL` depuis
  le `.env` racine. Jamais d'écrasement sans `--force` : ces fichiers contiennent des clés.
- `scripts/install-hooks.mjs` branché sur `prepare` : `pnpm install` active les hooks
  Git. Silencieux et sans échec hors dépôt Git.
- `packages/database/prisma.config.ts` charge `.env.local` puis `.env`, et **échoue avec
  un message explicite** si `DATABASE_URL` est absente plutôt que de laisser Prisma
  produire une erreur incompréhensible.
- `project:init` appelle `env:setup` et affiche en sortie ce qui reste : historique Git,
  dépôt distant, clés de service, arbitrage des intégrations, premier modèle de données.
  Ces points restent **manuels par choix** : ce sont des décisions, pas des commandes.
**Vérifié** : clone propre (sans `.git`, `node_modules`, `.env*`) →
`project:init --name seed-demo --port 5441` → `pnpm install` (hooks activés) →
`docker compose up -d` (conteneur et volume propres au dossier) → `pnpm verify`
(lint, typecheck 24 workspaces, tests, build) → `pnpm migrate --name init` : migration
créée et appliquée sur la base du clone. Aucune intervention manuelle entre les étapes.
**Conséquences** : un nouveau projet démarre en quatre commandes. Ce qui reste à faire
relève du produit, pas de la plomberie.

---

## D-011 — Dépôt réutilisable par copie : identifiants neutres, journal séparé

**Date** : 2026-08-05
**Contexte** : le dépôt devait pouvoir servir de point de départ à d'autres projets par
simple copie du dossier. 18 occurrences de `project0` étaient figées dans 12 fichiers
versionnés, et `docs/` mélangeait deux natures : la description du squelette (vraie pour
toute copie) et le journal de **ce** projet (décisions, risques, hypothèses).
**Décision** :
- identifiants neutralisés — règles Semgrep `local-*` (fichier `local-rules.yaml`),
  préfixe de hook `[repo]`, `compose.yaml` sans `container_name` ni nom de volume
  (Docker Compose nomme d'après le dossier), base et port via `POSTGRES_DB` /
  `POSTGRES_PORT` lus dans un `.env` racine non versionné ;
- surface portant le nom du projet réduite à **deux** endroits : `package.json` et le
  titre du README ;
- `docs/_skeletons/` contient les versions vierges des six documents « journal »
  (`PROJECT_CONTEXT`, `DOMAIN_MODEL`, `DATA_DICTIONARY`, `ASSUMPTIONS`, `RISKS`,
  `DECISIONS`) ; les quatre autres décrivent le squelette et restent en place ;
- `pnpm project:init --name <slug>` stampe le nom, restaure les squelettes, écrit le
  `.env` et supprime le graphe généré. Il ne touche **ni à Git, ni au code, ni aux
  dépendances** : ces actions restent des décisions humaines, rappelées en sortie.
**Vérifié** : copie du dépôt dans un dossier séparé, `project:init --name demo-app
--port 5439`, puis `pnpm install --frozen-lockfile`, `lint`, `typecheck` (24 workspaces),
`test`, `build --filter=app...` — tous au vert sous le nouveau nom.
**Conséquences** : la copie reproduit un état **daté**. Les correctifs de dérive amont
sont figés par `pnpm-lock.yaml` ; toute montée de version rouvre le sujet. Ce dépôt n'est
pas une graine maintenue : il n'y a ni versionnage, ni test d'intégration contre les
nouvelles versions de next-forge.

---

## D-009 — Durcissement de la chaîne d'approvisionnement

**Date** : 2026-08-04
**Contexte** : les packs Semgrep `p/owasp-top-ten` signalaient six faiblesses de chaîne
d'approvisionnement (actions GitHub sur tags mobiles, réglages pnpm, absence de cooldown
Dependabot).
**Décision** :
- actions GitHub épinglées à un **SHA de commit** avec la version en commentaire ;
- `pnpm-workspace.yaml` : `trustPolicy: no-downgrade` et `blockExoticSubdeps: true` ;
- `.github/dependabot.yml` : `cooldown.default-days: 7` sur les trois écosystèmes ;
- `minimumReleaseAge` **écarté** : essayé à 7 jours, il rend `pnpm install` non
  reproductible dès qu'une dépendance transitive n'a qu'une version récente
  (`@rollup/rollup-freebsd-arm64` via `@sentry/nextjs`). Le délai est appliqué à
  l'endroit où les versions entrent réellement : le cooldown Dependabot. Exception
  documentée par un `nosemgrep` daté dans `pnpm-workspace.yaml`.
**Conséquences** : `semgrep` passe à **0 constat** sur 150 règles / 385 fichiers.
`trustPolicy` a immédiatement détecté un cas réel — voir D-003.

---

## D-010 — Dépendances de workspace implicites déclarées

**Date** : 2026-08-04
**Contexte** : `pnpm boundaries` remontait trois imports non déclarés
(`apps/app` → `@repo/email`, `apps/api` → `@repo/email`, `apps/web` → `@repo/auth`).
Ils ne fonctionnaient que grâce aux alias `paths` de TypeScript.
**Décision** : déclarer ces dépendances en `workspace:*` dans les `package.json` concernés.
**Conséquences** : `pnpm boundaries` passe à 0 problème ; le graphe de dépendances reflète
la réalité.

---

## D-008 — Variables d'environnement : `VERCEL_PROJECT_PRODUCTION_URL` sans schéma

**Date** : 2026-08-04
**Contexte** : les `.env.example` du template livraient `http://localhost:3000` alors que
le code compose `${protocol}://${VERCEL_PROJECT_PRODUCTION_URL}` — le build échouait
(`metadataBase` = `https://http`).
**Décision** : valeur sans schéma (`localhost:3000`) dans les `.env.example` des trois apps.
**Conséquences** : `apps/app` et `apps/api` se construisent (`next build` vérifié).
