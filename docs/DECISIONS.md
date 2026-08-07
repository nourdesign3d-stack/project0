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

## D-057 — Les affirmations vérifiables du dépôt sont devenues exécutoires

**Date** : 2026-08-07
**Contexte** : deux audits successifs ont désigné la même cause racine — *un texte annonce
une protection, et personne ne vérifie que le code la sert*. Au 2026-08-07, **onze
affirmations documentaires étaient fausses**, dont trois portaient sur des contrôles de
sécurité (T-2002).

Les corriger ne suffit pas : elles redeviendront fausses. Un document de sécurité périmé
est **pire qu'absent**, parce qu'on s'y fie.

**Trois affirmations sont désormais vérifiées mécaniquement**
(`apps/api/__tests__/documentation-claims.test.ts`) :

1. **les fichiers de spec cités par la CI existent** — le workflow renvoyait à
   `access-control.spec.ts` comme portant le parcours à identifiants, alors que D-037
   l'avait déplacé ; une référence périmée dans un commentaire de sécurité envoie le
   prochain lecteur au mauvais endroit ;
2. **les trois apps appliquent bien les en-têtes** — l'affirmation était fausse pour deux
   d'entre elles jusqu'à D-034, et rien ne l'aurait signalé, la suite e2e ne démarrant
   qu'une application (R-026) ;
3. **chaque modèle Prisma figure au dictionnaire de données** — ce test a **immédiatement
   trouvé une dérive réelle** : `WebhookEvent`, introduit en D-023 puis étendu en D-049,
   n'y avait jamais été inscrit. Un modèle absent du dictionnaire est un modèle dont
   personne n'a décidé s'il portait une donnée sensible.

Les huit autres relèvent du jugement et restent à la charge de la revue. **Le dire vaut
mieux que prétendre tout couvrir** — c'est précisément l'erreur que ce dépôt répète.

**Ce que `SECURITY_MODEL.md` affirmait à tort** : l'idempotence « à implémenter » (en
place depuis D-023), le filtrage Sentry « à faire » (fait, et ses deux angles morts sont
maintenant nommés), un « contenu CMS » qui n'existe plus (D-031), Clerk « non configuré »
sans dire qu'il avait été éprouvé (D-018), la sauvegarde « ni définie ni testée » alors
que le mécanisme a été répété (D-027), et l'absence de toute mention du dépôt public et de
la protection de `main`.

---

## D-062 — La sauvegarde est automatisée, et son angle mort est nommé

**Date** : 2026-08-07
**Contexte** : la politique existait, le mécanisme aussi, mais rien ne tournait tout seul.
Une politique qu'il faut se rappeler d'appliquer n'est pas une politique.

`pnpm db:backup:scheduled` est fait pour tourner **sans témoin**, ce qui change trois
choses par rapport au geste manuel :

- **rétention** (30 jours + 12 mensuelles) — sans elle, le dossier croît indéfiniment, et
  une sauvegarde qui remplit le disque finit par empêcher les suivantes ;
- **trace de succès** (`.derniere-reussite`) — sans elle, rien ne distingue « a tourné et
  réussi » de « n'a jamais tourné » ;
- **échec bruyant** — journal, notification système, code de sortie `1`.

**Un dump vide est refusé.** `pg_dump` peut sortir en `0` sans rien produire si la
connexion tombe au mauvais moment ; écrire ce fichier reviendrait à archiver du vide en
croyant sauvegarder.

**La rétention ne supprime jamais la sauvegarde la plus récente**, quelle que soit son
ancienneté. Si l'automatisation s'arrête deux mois, la rétention ne doit pas achever le
travail en effaçant la dernière copie — c'est le moment où elle compte le plus. Un test
l'exige, et il a corrigé une attente erronée que j'avais écrite dans un autre cas.

**Chiffrement** : FileVault est actif sur le poste en service — vérifié, pas supposé. Un
fichier écrit sur ce disque est chiffré au repos par le système, sans outil supplémentaire.

**Éprouvé par exécution**, pas seulement écrit : succès (5600 octets, permissions `600`,
journal, preuve de vie) et échec simulé (code `1`, échec journalisé, **preuve de vie
inchangée** — un échec ne peut pas se déguiser en succès).

### Les deux angles morts, nommés plutôt que tus

**La copie vit sur le poste de travail.** Elle protège de la perte du compte Neon — le
scénario le plus probable — mais pas de la perte du poste. Ce n'est pas une copie hors
site, et il faudra en ajouter une quand des données réelles existeront.

**Une notification ne se déclenche que si le script s'exécute.** Elle attrape les échecs,
jamais les **absences** d'exécution : machine éteinte plusieurs jours, agent déchargé,
`pnpm` absent de l'environnement de `launchd`. C'est le cas le plus dangereux — rien ne se
passe, et rien ne le dit.

Le seul dispositif qui attrape une absence est **extérieur à la machine** : un moniteur de
pulsation, appelé après chaque succès via `BACKUP_HEARTBEAT_URL`. Tant qu'il n'est pas
posé, une interruption prolongée reste invisible. C'est écrit dans le script **et** dans
`RECOVERY.md`, parce que c'est exactement le genre de limite qu'on oublie six mois plus
tard.

---

## D-061 — Il n'y a pas un RPO, il y en a deux

**Date** : 2026-08-07
**Contexte** : D-059 arrêtait « RPO 1 h au premier client » et affirmait que « c'est la
rétention d'historique du plan qui fixe le RPO ». **Ce raccourci est faux**, et il a
produit un effet concret : le propriétaire, cherchant à s'aligner sur la politique, a
d'abord **réduit** la rétention de 6 h à 1 h — c'est-à-dire réduit sa marge de sécurité en
croyant l'ajuster.

La rétention d'historique n'est pas le RPO. C'est la profondeur à laquelle on peut
remonter le temps, donc une **fenêtre de détection**. Deux scénarios, deux chiffres :

| Scénario | Ce qui sauve | Perte réelle |
| --- | --- | --- |
| Erreur logique (suppression, migration ratée) | historique PITR | **quasi nulle**, si détectée dans la fenêtre |
| Perte du compte (suspension, facturation, compromission) | sauvegarde **hors hébergeur** | **intervalle entre deux sauvegardes** |

Avec 6 heures de fenêtre, une migration destructrice passée à 14 h 00 se rattrape jusqu'à
20 h 00 et ne coûte presque rien. Passé ce délai, on retombe sur le second scénario.

**Conséquence pratique** : le seul levier sur le second scénario est la **fréquence de
sauvegarde**, et il ne dépend d'aucun plan payant. Retenu : 1 par jour aujourd'hui,
1 toutes les 6 heures au premier client — même coût, exposition ramenée de 24 h à 6 h.

**Mesure** : `History retention` = 6 h sur le projet Neon en service, maximum de l'offre
gratuite. Aucune raison de descendre en dessous, l'historique pesant 6,45 Mo.

**Ce que ce cas enseigne**, et qui vaut au-delà des sauvegardes : une simplification écrite
dans un document de référence ne reste pas une simplification. Elle est appliquée. Celle-ci
a fait *baisser* une protection — un raccourci pédagogique s'est transformé en instruction,
et l'instruction était mauvaise. C'est la même famille que tout ce que ce dépôt corrige
depuis trois jours, à ceci près que l'affirmation fausse était **la mienne**, écrite la
veille.

---

## D-060 — Chaque risque porte désormais un déclencheur de réexamen

**Date** : 2026-08-07
**Contexte** : les 27 risques portaient « à désigner » comme propriétaire. Remplir cette
colonne sur un projet à une personne paraît absurde — le nom serait toujours le même.

**Ce n'est pas le nom qui manquait, c'est le déclencheur.** R-011 en est la
démonstration : il est resté marqué « accepté » deux jours après que sa cause — un plan
GitHub gratuit sur dépôt privé — avait disparu, parce que personne n'avait la charge de le
rouvrir. Un risque sans propriétaire n'est réexaminé par personne ; un risque avec un
propriétaire mais sans déclencheur non plus.

**Trois familles seulement**, et chaque ligne porte l'événement qui doit la faire
ressortir :

| Propriétaire | Ce que cela veut dire | Exemples |
| --- | --- | --- |
| `propriétaire produit` | la décision n'attend pas du code, elle attend un arbitrage | R-001, R-004, R-009, R-024, R-025 |
| `propriétaire du dépôt` | gouvernance du dépôt et de ses accès | R-011, R-016 |
| `technique` | se traite au fil du code | les vingt autres |

Les déclencheurs sont de deux natures : une **date** quand elle existe (`chokidar`
2026-11-05, `semver` 2026-11-07, montée de `pg` en 9) ou l'**événement** qui rend le
risque à nouveau actuel (« à chaque route publique ajoutée », « avant le 1er utilisateur
réel », « à chaque relation ajoutée au schéma »).

C'est la partie qui a de la valeur : elle transforme un registre qu'on relit par
conscience en un registre qui **vient à vous** au moment où il compte.

---

## D-059 — La politique de sauvegarde est décidée, et le proxy d'analytique ne pointe plus vers la mauvaise juridiction

**Date** : 2026-08-07
**Décidé par** : propriétaire du produit.

**Politique de sauvegarde** — R-004 ouvert depuis l'initialisation, H-008 levée. Deux
régimes, parce que la tolérance change le jour où les données ne vous appartiennent plus :
RPO 24 h puis **1 h** au premier client, RTO 24 h puis **4 h**, rétention 30 jours
glissants plus 12 mensuelles, répétition trimestrielle.

Deux points comptent plus que les chiffres, et sont écrits comme tels :

- **l'emplacement doit être hors de l'hébergeur de la base.** Une sauvegarde chez le même
  hébergeur ne protège que d'une erreur de manipulation, pas de la perte du compte ;
- **le PITR n'est pas une sauvegarde**, c'est un historique. C'est la fenêtre du plan qui
  fixe réellement le RPO, pas l'intention écrite.

⚠️ **Décidée n'est pas appliquée.** Cinq étapes restent : vérifier la fenêtre PITR,
choisir l'emplacement, automatiser, poser une **alerte d'échec** — une sauvegarde qui
échoue en silence donne l'assurance sans le contenu —, et planifier la première
répétition. `RECOVERY.md` le dit ligne à ligne plutôt que de laisser croire que la
décision suffit.

**Proxy PostHog.** Le proxy `/ingest` — qui existe pour que la mesure ne soit pas
silencieusement amputée par les bloqueurs — était **codé en dur sur la région
États-Unis**. Pour un projet dont les données doivent rester dans l'Union européenne, il
expédiait donc l'intégralité du trafic mesuré vers la mauvaise juridiction, sans que rien
ne l'indique. `POSTHOG_REGION` la rend explicite, **défaut `eu`** : un mauvais défaut de
localisation coûte plus cher qu'un défaut inutile.

**Pages légales.** Ce qui est vérifiable dans le dépôt y est désormais écrit — liste des
destinataires, catégories de données, durées de conservation. Le reste est marqué « à
compléter » et le bandeau, réécrit, distingue les deux. Il ne dit plus « modèle non
rédigé » mais « non relu par un juriste », ce qui est la vraie limite.

---

## D-058 — Deux tests qui ne pouvaient pas échouer

**Date** : 2026-08-07

**`/health`** vérifiait `status === 200` et `body === "OK"` — exactement les deux
constantes que la route écrit. Un test qui relit ce que le code vient d'écrire ne teste
rien : c'est la même idée exprimée deux fois.

Ce qui mérite d'être gardé n'est pas la valeur renvoyée mais **la nature de la sonde** :
vivacité, donc sans dépendance externe, synchrone, non mise en cache. Les trois cas
échouent sur une sonde « améliorée » en asynchrone et dépendante — vu échouer.

**Les prérequis de `pnpm verify` sont écrits** (`QUALITY_GATES.md`), avec ce qu'il ne
couvre pas : il **n'exécute pas Playwright**. C'est sa limite la plus coûteuse, et elle a
été payée le 2026-08-07 — un `test.use({ video })` dans un `describe` a passé la chaîne
locale et fait échouer la CI. La conditionnalité de la couverture du parcours authentifié
(`ENABLE_E2E`) y est également explicite : sans les secrets, les scénarios sont
**ignorés**, pas réussis.

---

## D-056 — Le dépôt ne pouvait plus appliquer aucun correctif de sécurité

**Date** : 2026-08-07
**Contexte** : `sharp` était la **seule** des 58 alertes de l'arbre de production
réellement atteignable — quatre CVE héritées de libvips, gravité haute, sur le chemin
de l'optimisation d'images. La version corrigée existait.

**Elle était inapplicable.** `pnpm add sharp@0.35.3` échouait sur
`ERR_PNPM_TRUST_DOWNGRADE` pour `semver@6.3.1`, atteint par
`@vitejs/plugin-react > @babel/core > @babel/helper-compilation-targets` — **un paquet
déjà présent dans le lockfile**. `pnpm install --frozen-lockfile` passait, la CI était
verte, et personne n'avait essayé de monter quoi que ce soit depuis la mise en place de
`trustPolicy` : le dépôt était **gelé** sans que rien ne le signale.

C'est le coût de R-015 devenu concret, et il est plus lourd qu'annoncé : un contrôle qui
empêche d'installer un paquet douteux est utile ; un contrôle qui empêche de **corriger**
ne protège plus rien.

**Exception nommée, datée, avec échéance** — même forme que `chokidar` (D-013). Elle
n'admet aucun paquet nouveau : elle reconnaît un paquet déjà installé, dont rien sur le
disque ne change. Ce qu'elle débloque, c'est la capacité à corriger.

**Deux gestes, pas un.** Monter la dépendance directe de `apps/web` ne suffisait pas :
`next` embarque sa propre copie de `sharp` en 0.34.x. Il a fallu un `override` sur tout
l'arbre. Mesure avant/après : **1 alerte `sharp` → 0**, total production 58 → 57.

Le triage complet des 58 alertes est dans `docs/RISKS.md` (R-014) : ~32 viennent de
`@prisma/dev` — outillage local —, ~12 de `@repo/ai` qu'aucune application n'importe, le
reste est du temps de build. **Une seule était atteignable, et c'est celle-là.**

---

## D-055 — Deux affirmations que le passage en public a rendues fausses

**Date** : 2026-08-07

**`/health` répondait `200` sans rien vérifier**, et rien ne le disait. Un contrôle qui
ne peut pas échouer donne une assurance qu'il ne fournit pas : une supervision branchée
dessus resterait au vert pendant que la base est injoignable. La route dit désormais ce
qu'elle affirme — le processus sert du HTTP — et ce qu'elle n'affirme pas.

Elle **n'interroge toujours pas la base**, et c'est délibéré : une sonde de vivacité qui
échoue fait *redémarrer* le processus. La faire dépendre de la base transformerait une
panne de base en boucle de redémarrages, aggravant l'incident au lieu de le signaler. La
sonde de disponibilité est un autre objet, à écrire quand un orchestrateur en consommera
une. `cache-control: no-store` a été ajouté : une réponse de sonde mise en cache ne
prouve plus rien du moment présent.

**Les artefacts de CI ne sont plus téléchargeables par les seuls collaborateurs.** Depuis
le passage en public, n'importe qui le peut, sans authentification. Le commentaire du
workflow décrivait l'ancien modèle de menace et renvoyait de surcroît à
`access-control.spec.ts`, alors que D-037 avait déplacé le parcours à identifiants dans
`authenticated-journey.spec.ts`. Les deux sont corrigés, et la question à se poser avant
d'ajouter un artefact est désormais écrite : **qui pourra le télécharger**, et non qui
devrait.

**`apps/api/instrumentation-client.ts` est supprimé** : il initialisait Sentry côté
navigateur et l'analytique pour une application qui ne sert que des webhooks, un cron et
`/health`.

---

## D-054 — Le formulaire de contact renvoyait ses erreurs internes et se laissait contourner

**Date** : 2026-08-07
**Contexte** : seule frontière publique non authentifiée de `apps/web`, et **aucun test
ne la gardait** — l'application n'en avait aucun.

**La clé de limitation de débit venait de `x-forwarded-for` tel quel.** Trois défauts en
une ligne : l'en-tête est fourni par le client, donc une valeur différente à chaque
requête annulait la limite ; c'est une liste séparée par des virgules, dont la chaîne
entière servait de clé ; et absent, il donnait `contact_form_null` — un seau **partagé
par tous**, où le premier visiteur consommait le quota de tout le monde.

Seul le premier élément est retenu. Sans en-tête, on **refuse** plutôt que de partager un
seau. La limite reste ce qu'elle est : un garde-fou contre l'usage abusif ordinaire,
digne de confiance derrière un proxy qui réécrit l'en-tête, falsifiable sans lui — R-003.

**Toute erreur serveur repartait au navigateur.** « Email is not configured. »
renseignait un visiteur anonyme sur l'état de configuration, et une erreur du
fournisseur d'e-mail partait telle quelle. Trois messages neutres remplacent le tout ; le
détail reste côté serveur, où il est utile. Un refus de validation ne devient plus un
incident Sentry (D-052).

**`apps/web` a désormais une suite de tests** — la première. Six cas, dont **cinq vus
échouer** sur le code d'avant.

---

## D-053 — La contrainte du pooler Neon est écrite là où on la lit

**Date** : 2026-08-07
**Contexte** : D-025 établissait qu'il faut employer le point d'accès « pooler » de Neon
— le pilote est un client Postgres ordinaire (D-021), il ouvre une connexion par
instance, et les fonctions serverless en démarrent beaucoup. Cette contrainte vivait
dans `DECISIONS.md`, c'est-à-dire **nulle part pour qui renseigne une variable**.

Elle figure désormais dans `DEPLOYMENT.md`, à côté de `DATABASE_URL`. Le coût de
l'oubli est asymétrique : l'erreur (`too many connections`) survient **sous trafic**,
jamais en test, et la limite du plan est atteinte bien avant la charge réelle.

---

## D-052 — Sentry ne reçoit plus le bruit que l'appelant contrôle

**Date** : 2026-08-07
**Contexte** : `parseError` appelait `Sentry.captureException` **systématiquement**. Sur
une frontière publique, cela signifiait un événement Sentry par signature de webhook
refusée — donc un par appel forgé.

Sur un dépôt sans limitation de débit (R-003), tout appelant anonyme pouvait ainsi
remplir le quota Sentry du projet, et surtout **noyer les vraies erreurs sous du bruit
qu'il choisit**. Un outil de diagnostic qu'un tiers peut saturer cesse d'être un outil
de diagnostic.

`parseError(error, { expected: true })` marque une erreur **attendue** : refus de
validation, signature invalide, entrée malformée. Elle reste journalisée — le refus doit
se voir — sans devenir un incident. Le défaut reste `false` : oublier l'option remonte
l'erreur, ce qui est le sens le moins dangereux des deux.

**Et la contrepartie, enfin payée.** `.claude/rules/security.md` exige depuis R-018 que
chaque frontière serveur journalise un **identifiant de corrélation**, compensation du
bridage de Sentry (ni corps, ni en-têtes, ni variables locales). Aucune ne le faisait.
Les deux webhooks posent désormais `webhook.provider` et `webhook.event_id` sur la trace
— pour Clerk, le `svix-id`, celui que porte aussi le tableau de bord du fournisseur.
Sans ce point commun, un incident vu dans Sentry ne peut être rapproché ni du journal ni
de la livraison chez le fournisseur.

---

## D-051 — Une fonctionnalité non configurée se dégrade au lieu de casser sa page

**Date** : 2026-08-07
**Contexte** : `getAppPortal()` **lève** quand `SVIX_TOKEN` est absent, et rien ne
rattrapait cette exception. Dans l'installation par défaut — celle de **tout** projet
dérivé de la graine, où aucun jeton Svix n'existe — ouvrir `/webhooks` produisait une
erreur serveur.

La page affiche désormais un état « non configuré » nommant la variable à renseigner.
`webhooks.isConfigured()` porte la question, plutôt qu'un `try`/`catch` autour d'un
appel dont on ne saurait pas distinguer les causes d'échec.

`send()` continue de lever, et c'est voulu : un envoi silencieusement ignoré serait pire
qu'un échec. **La distinction est entre afficher et agir.**

---

## D-050 — La tâche planifiée ne dépend plus du modèle de démonstration

**Date** : 2026-08-07
**Contexte** : `keep-alive` réveillait la connexion par `database.page.count()`. Or
`Page` est le modèle de **démonstration** que `DOMAIN_MODEL.md` prescrit explicitement de
supprimer.

Le jour où quelqu'un suit cette consigne, la tâche cesse de compiler et la base retombe
en veille — sans qu'aucun document ne relie les deux gestes. Une consigne du dépôt
cassait donc une autre partie du dépôt.

`SELECT 1` ne suppose rien du contenu de la base. C'est le **seul** usage de SQL brut du
dépôt : requête littérale, aucune interpolation, rien de ce qui vient de la requête HTTP
n'y entre. Un test exige que la requête reste exactement `SELECT 1` — tout ce qui nomme
une table réintroduirait le couplage.

---

## D-049 — Une réservation abandonnée bloquait l'événement pour toujours

**Date** : 2026-08-07
**Migration** : `20260807095046_webhook_event_completion` (expand : colonne nullable +
index).

**Contexte** : une ligne de `WebhookEvent` signifiait seulement « vu ». Un processus
interrompu **entre** la réservation et la fin — redéploiement, délai dépassé, arrêt du
conteneur — laissait donc une réservation que rien ne libérait. Le réessai du
fournisseur était pris pour un doublon, et l'événement perdu en silence : le fournisseur
avait reçu un `200`, il ne réessaierait plus.

Ni `releaseEvent` ni aucun autre dispositif ne pouvait rattraper ce cas, puisque le
processus qui aurait dû libérer n'existait plus. C'est le troisième chemin de perte
silencieuse identifié par l'audit (TR-2102), et le seul qu'aucun correctif applicatif ne
pouvait couvrir.

**`completedAt` distingue réservé de terminé.** Une réservation non aboutie depuis plus
de quinze minutes est reprise. Ce délai est très au-delà de la durée d'un traitement
(quelques secondes) et en deçà de la fenêtre de réessai des fournisseurs : trop court,
deux livraisons simultanées se marcheraient dessus ; trop long, l'événement resterait
bloqué au-delà des réessais et serait perdu pour de bon.

La reprise est **atomique** — filtre et écriture dans un seul `updateMany`. Un
`findUnique` suivi d'un `update` serait une course, pas un contrôle : deux livraisons
simultanées liraient toutes deux « périmée » avant que l'une n'écrive.

**Et la table est enfin bornée.** `WebhookEvent` ne croissait que — une ligne par
livraison, jamais supprimée. Rien ne l'aurait signalé : c'est le genre de dette qui ne se
manifeste qu'en production, tard, sous la forme d'une latence inexpliquée. Une tâche
planifiée purge à 30 jours, au-delà de la fenêtre de réessai de tous les fournisseurs
(Stripe 3 jours, Svix environ 5) : passé ce délai, aucun rejeu légitime ne peut plus
arriver.

⚠️ **Seules les lignes terminées sont purgées.** Une réservation jamais aboutie est une
anomalie : la supprimer effacerait la trace du seul incident qui mérite d'être vu. Elle
est comptée et journalisée.

**Sur la migration.** Elle est *expand* : colonne nullable et index, aucune donnée
réécrite, aucune colonne supprimée. Elle s'applique donc avant le code qui l'utilise, et
le code d'avant fonctionne sans elle — le retour arrière est possible sans perte.
`completedAt` NULL sur les lignes existantes signifie « issue inconnue », ce qui est la
valeur juste : prétendre le contraire les rendrait à tort non rejouables. Conséquence
assumée : ces lignes deviendront rejouables passé le délai de reprise — sans effet sur
une graine sans trafic réel.

**Vérifiée sur la base locale** : migration appliquée, `\d "WebhookEvent"` confirme la
colonne et l'index `WebhookEvent_receivedAt_idx`, `migrate:status` à jour.
## D-048 — La protection de `main` est enfin côté serveur

**Date** : 2026-08-07
**Contexte** : R-011 était **accepté** depuis le 2026-08-05 — la seule protection de
`main` était un hook `pre-push` local, contournable et limité aux postes qui l'avaient
installé. La cause était administrative : dépôt privé sur plan gratuit, l'API répondant
`403 — Upgrade to GitHub Pro or make this repository public`.

Le passage en public du 2026-08-07 a levé la contrainte. Un audit l'a relevé le jour
même : la protection était **redevenue possible sans que personne ne le remarque**, et
trois documents affirmaient encore qu'elle était refusée.

**Appliqué** : `Lint · Typecheck · Test · Build` et `Semgrep` requis, poussée forcée et
suppression de branche interdites, conversations résolues avant fusion.

**Deux limites assumées**, à nommer plutôt que laisser croire à une protection complète :
la **revue n'est pas exigée** — à un seul mainteneur, GitHub interdit d'approuver sa
propre PR, et l'exiger bloquerait toute fusion ; les **administrateurs ne sont pas soumis
à la règle**, ce qui laisse une sortie de secours en incident. C'est une confiance
accordée au propriétaire, pas un contrôle.

**Ce que ce cas enseigne** : une contrainte externe disparue ne se signale pas
d'elle-même. Un risque accepté pour une raison qui n'existe plus reste marqué accepté
jusqu'à ce que quelqu'un aille regarder — d'où l'utilité d'un registre qui **nomme la
cause** de l'acceptation, et pas seulement le fait de l'accepter.

---

## D-047 — La sauvegarde échouait dès que le port Postgres n'était pas 5432

**Date** : 2026-08-07
**Contexte** : les outils Postgres s'exécutent **dans** le conteneur (D-027 : la version
du client doit suivre celle du serveur). Mais `DATABASE_URL` décrit la base telle que
l'**hôte** la voit — `localhost:<POSTGRES_PORT>`, le port publié par `compose.yaml`. Dans
le conteneur, `localhost` désigne le conteneur lui-même, et Postgres y écoute toujours
sur 5432.

Tant que `POSTGRES_PORT` valait 5432, les deux points de vue coïncidaient et personne ne
voyait le problème. Dès qu'il change — parce que 5432 est déjà pris sur le poste, ce que
`.env.example` recommande justement de vérifier — la sauvegarde échouait sur un refus de
connexion **dont le message ne désignait pas la cause**.

`forContainer(url)` traduit désormais une URL locale vers le point de vue du conteneur.
Une URL distante n'est jamais réécrite : elle est déjà exprimée du point de vue du
réseau, et la traduire ferait pointer la sauvegarde sur le conteneur local — l'erreur
serait alors silencieuse et bien pire. Trois tests couvrent les trois cas (local, distant,
illisible).

---

## D-046 — Un secret Clerk mal formé produisait une boucle de réessais

**Date** : 2026-08-07
**Contexte** : `new Webhook(secret)` était construit **hors** du `try`. Il lève sur un
secret mal formé — valeur tronquée à la copie, préfixe `whsec_` oublié. L'exception
remontait non capturée : Next répondait `500`, Clerk réessayait, et chaque réessai
reproduisait le même `500`.

Une faute de frappe dans une variable d'environnement suffisait donc à installer une
**boucle de réessais** sur une route publique, sur un dépôt qui n'a ni pare-feu ni
limitation de débit (R-003).

La construction est passée dans le `try` existant. Le refus est un `400` : ni une
signature invalide ni un secret mal configuré ne deviendront valides par un réessai. Le
second cas est journalisé — c'est une erreur d'exploitation, pas un appel forgé.

---

## D-045 — Le filtre Sentry ne connaissait qu'un emplacement de secret sur trois

**Date** : 2026-08-07
**Contexte** : D-035 avait élargi le filtre au raisonnement **mot par mot**, corrigeant
son ancrage en début de chaîne. Mais il n'a jamais regardé que la **chaîne de requête**.

Or un secret voyage dans une URL par trois emplacements : `?cle=…`, le **fragment**
`#access_token=…` — la forme qu'emploient les redirections OAuth implicites — et la
partie *userinfo* `postgresql://user:motdepasse@hôte/`. Les deux derniers passaient
intacts, alors que le commentaire annonçait qu'une URL était bornée.

Le filtre coupe désormais au premier séparateur (`?` ou `#`) et retire la partie
*userinfo* de toute adresse. Effet de bord accepté : un `#` légitime dans une adresse
disparaît aussi — on perd du contexte plutôt que de laisser fuir un jeton. Un `#`
**hors** adresse (numéro de ticket, code couleur) est laissé intact, et un test l'exige.

**Deux formes restent hors de portée, et le code le dit maintenant** : un secret placé
dans un **segment de chemin** (`/reset/SECRET`) est indiscernable d'un identifiant de
ressource, et un secret dans un mot sans `/` ni schéma n'est pas une adresse. Ce filtre
borne les URL ; il ne remplace pas la règle « ne jamais journaliser de valeur sensible ».

---

## D-044 — L'inventaire de routes ignorait trois formes de points d'entrée

**Date** : 2026-08-07
**Contexte** : l'inventaire qui alimente les deux contrôles de R-013 ne connaissait que
`page.tsx` et `route.ts`. Or Next accepte les mêmes noms avec **cinq extensions**
(`js`, `jsx`, `ts`, `tsx`, `mjs`) et reconnaît aussi `default` pour les routes
parallèles. Un `route.tsx` ou un `page.ts` — noms parfaitement valides, qu'un éditeur
crée sans qu'on y pense — n'était donc **pas inventorié**.

Les **server actions** n'y figuraient pas davantage, alors que Next les expose par un
`POST` avec un identifiant d'action : ce sont des points d'entrée HTTP à part entière,
qui doivent porter leur propre contrôle.

Une route hors inventaire n'est pas « mal testée » : elle n'est pas testée. Et c'est le
plancher de R-013, le seul contrôle qui tourne sans serveur.

Corrigé aussi côté exécution : une server action n'a pas d'URL, `toUrlPath` renvoie
`null` pour elle. Sans quoi `actions/users/get.ts` produisait `/actions/users`, une URL
inexistante dont le `404` figurait parmi les statuts de refus acceptés — le test passait
**sans avoir rien touché**.

**Preuve** : dix sondes dans un dossier temporaire, dont cinq échouaient sur l'inventaire
d'avant. Les sondes vivent hors de `app/` : y poser de vrais fichiers créerait de vraies
routes.

---

## D-043 — Les identifiants directs ne partent plus vers l'outil d'analytique

**Date** : 2026-08-07
**Décidé par** : propriétaire produit, 2026-08-07.
**Contexte** : `handleUserCreated` et `handleUserUpdated` transmettaient à PostHog
l'`email`, le `firstName`, le `lastName`, le `phoneNumber` et l'URL de la photo — à
chaque création **et à chaque mise à jour** d'utilisateur.

Quatre identifiants directs et une image de personne partaient donc vers un
sous-traitant, **sans chemin de retour** : supprimer un compte pose ici un marqueur
`deleted` et n'efface rien chez le destinataire.

**Option retenue** : ne transmettre que l'identifiant **pseudonyme** de Clerk, nécessaire
pour rattacher les événements entre eux, et la date de création, qui sert aux cohortes
sans désigner personne. Contrepartie acceptée : on ne peut plus retrouver un utilisateur
par son e-mail dans l'interface de l'outil.

C'est le bon défaut **pour une graine** : un projet dérivé qui a besoin de ce
rapprochement peut élargir le jeu d'attributs, et ce sera alors une décision prise,
inscrite dans `RISKS.md` et déclarée aux personnes concernées — pas un défaut hérité.

Les deux gestionnaires portaient le même bloc **dupliqué** : un seul `publicProperties`
les sert désormais, et un test couvre les deux chemins — corriger l'un en oubliant
l'autre aurait laissé la fuite ouverte sur le plus fréquent.
## D-042 — Le premier geste prescrit au repreneur ne fonctionnait pas

**Date** : 2026-08-07
**Contexte** : le bloc « Démarrer » du README prescrivait
`cp apps/app/.env.example apps/app/.env.local` — alors que **le README lui-même**
expliquait deux lignes plus bas qu'une variable optionnelle laissée à `""` échoue la
validation Zod. Il omettait aussi la génération du client Prisma, que `pnpm install`
ne déclenche pas.

Un dépôt destiné à être **cloné** ne peut pas se permettre cela : c'est la première
chose que fait celui qui arrive, et l'erreur obtenue ne désigne pas sa cause.

**Mesuré sur un clone vierge**, pas déduit. Après `git clone` puis `pnpm install` :

```
app/(authenticated)/page.tsx(51,23): error TS7006: Parameter 'page' implicitly has an 'any' type.
app/(authenticated)/search/page.tsx(59,23): error TS7006: …
../../packages/database/index.ts(4,30): error TS2307: Cannot find module './generated/client'
../../packages/database/index.ts(32,15): error TS2307: Cannot find module './generated/client'
```

Après `pnpm --filter @repo/database run build` : typecheck propre, sans autre
changement.

**Ce qui est corrigé.** Le bloc prescrit désormais `pnpm env:setup` — qui commente les
valeurs vides et renseigne `DATABASE_URL` — la génération du client Prisma, et
`pnpm migrate`. Chaque étape non évidente est justifiée à côté de la commande, parce
qu'une recette sans raison se fait contourner à la première contrariété.
`pnpm hooks:install` sort du bloc : il tourne déjà à l'installation.

Corrigé au passage : `setup-env.mjs` citait **BaseHub** parmi les services à
configurer, retiré depuis (D-031).

**Rendu exécutoire.** `apps/api/__tests__/onboarding.test.ts` lit le bloc « Démarrer »
du vrai README et exige qu'il prescrive `env:setup` et la génération Prisma, et qu'il
ne prescrive **pas** de copie d'un `.env.example`. Vu échouer sur le README d'avant
(`2 failed | 1 passed`). Le test ne rejoue pas l'installation — trop lente pour la
chaîne courante ; il garde ce qui a été prouvé une fois.

---

## D-041 — La libération d'une réservation avalait toute erreur

**Date** : 2026-08-07
**Contexte** : `releaseEvent` se terminait par `.catch(() => undefined)`. Toute erreur
de suppression — base injoignable, délai dépassé — disparaissait sans trace.

Or **l'échec de cette fonction produit précisément la perte qu'elle existe pour
empêcher**. Enchaînement complet : le traitement du webhook échoue, la libération
échoue aussi, la réservation survit ; le fournisseur réessaie, la réservation le fait
passer pour un doublon, et l'événement est acquitté sans avoir jamais été traité. Le
fournisseur, lui, a vu un `200` : il ne réessaiera plus.

Aucun dispositif du système ne peut le signaler — ni métrique, ni alerte, ni contrôle
de santé. C'est ce que l'audit du 2026-08-07 a nommé la perte silencieuse d'un
événement de paiement.

**Deux cas, désormais distingués.** `P2025` — la ligne n'existe pas — est sans
conséquence et attendu si deux chemins libèrent le même événement : ignoré. Tout le
reste est **journalisé avec le fournisseur et l'identifiant d'événement**, les deux
seuls éléments permettant de retrouver ce qui a été perdu chez le fournisseur et de le
rejouer à la main.

L'erreur n'est pas propagée : l'appelant est déjà dans son chemin d'échec, et la
masquer d'une seconde erreur ne l'aiderait pas.

**Preuve.** Deux tests : l'un exige que le journal porte `stripe` et `evt_1` quand la
suppression échoue — vu échouer sur le code d'avant (`1 failed | 15 passed`) ; l'autre
exige le silence sur `P2025`, pour que la correction ne devienne pas du bruit.

**Ce que ce défaut enseigne** : `.catch(() => undefined)` est la forme la plus compacte
d'un renoncement. Ici il occupait une ligne, sous un commentaire de quatre lignes
expliquant que perdre un événement en silence était « exactement ce que l'idempotence
est censée éviter ». Même famille que D-039.

---

## D-040 — Le garde-fou Bash se désarmait tout seul sous /tmp

**Date** : 2026-08-07
**Contexte** : D-036 corrigeait six défauts du garde-fou. L'un d'eux — l'exemption
du bac à sable temporaire ne voyant que les chemins **absolus** — a été réparé en
résolvant chaque argument depuis le dossier courant. **Cette correction en a créé une
bien pire.**

Résoudre depuis le dossier courant rend l'exemption **contagieuse**. Dès que le dépôt
lui-même vit sous `/tmp` ou `$TMPDIR` — un clone d'audit, un bac à sable d'agent, un
`mktemp -d` — tout argument relatif résout en zone temporaire, et **la totalité des
règles saute**. Y compris celles qui n'ont aucun rapport avec un chemin :
`git push --force`, `prisma db push`, `docker system prune`, `vercel env pull`.

C'est le contournement le plus large que ce garde-fou ait connu, et il ne demandait
aucun obscurcissement : il suffisait de travailler au mauvais endroit. Relevé en audit
le 2026-08-07 — par un auditeur qui travaillait précisément dans un clone temporaire.

**Deux corrections, parce qu'il y avait deux erreurs de raisonnement.**

*Un chemin doit être absolu par lui-même.* Le dossier courant n'entre plus dans la
décision : c'est ce qui rend le verdict indépendant de l'endroit où le dépôt est cloné.
Un chemin relatif désigne ce que contient le dossier courant — c'est-à-dire le dépôt —
et n'a jamais prouvé qu'on visait un bac à sable.

*L'exemption ne s'offre qu'aux règles qui portent sur des chemins.* Elles sont marquées
`sandboxable` : `rm`, `find`, `shred`, `truncate`. Les autres ne la reçoivent jamais.
Rien dans `git push --force origin main` n'est un chemin ; l'exempter parce que le
dossier courant est temporaire n'avait aucun sens.

**Preuve.** 15 cas rejouent des commandes **depuis un dossier temporaire**, le harnais
de test acceptant désormais un dossier d'exécution. Sur le code d'avant : `11 écart(s)
sur 130 cas`. Après : `130 cas vérifiés, aucun écart`.

**Ce que ce défaut enseigne**, et qui dépasse ce fichier : la correction de D-036 avait
été validée par des tests **tous lancés depuis la racine du dépôt**. Un harnais qui
n'exerce qu'un seul contexte d'exécution ne peut pas voir un défaut qui dépend du
contexte d'exécution. C'est le pendant exact de D-039 — sauf qu'ici, ce n'est pas un
commentaire qui promettait à tort, c'est un test.

---

## D-039 — Deux promesses que le code ne tenait pas

**Date** : 2026-08-06
**Contexte** : deux commentaires annonçaient une protection que leur code n'appliquait pas.
Ce ne sont pas des oublis de documentation : ce sont des **fausses assurances**, et elles
coûtent plus qu'un silence.

### Le webhook Stripe lisait le corps avant de vérifier l'en-tête

`await request.text()` précédait le contrôle de `stripe-signature`. Un appelant anonyme
faisait donc mettre en mémoire la totalité de sa charge utile **avant** qu'on ne découvre
qu'il n'avait produit aucune signature.

Sur une route publique, sans pare-feu ni limitation de débit (R-003), c'est le vecteur
d'épuisement mémoire le moins coûteux du dépôt : aucun secret à deviner, aucun compte à
créer. Le webhook Clerk faisait déjà l'inverse — il refuse avant de bufferiser.

Les deux lignes sont permutées. Un test le constate en piégeant `request.text()` : le
consommer avant le contrôle fait échouer le test. Vu échouer après rétablissement de
l'ordre fautif.

### `db:restore` ne demandait pas la confirmation qu'il revendiquait

Son en-tête disait : « une restauration lancée par inadvertance dans un `&&` est exactement
le scénario à empêcher ». Il ne l'empêchait pas. `--yes` était lu dans le **même `argv`**
que `--to database-url` : une seule ligne collée restaurait une base distante — donc
potentiellement la production — sans second geste humain.

La confirmation dépend désormais de la cible. `--to local`, qui vise le conteneur de
répétition, se contente de `--yes`. `--to database-url` exige de **saisir le nom de la
base** au terminal, et refuse tout net hors terminal : un enchaînement automatisé ne doit
pas pouvoir remplacer une base distante.

Le nom se recopie, il ne se colle pas par inadvertance — et l'écrire oblige à regarder la
cible affichée juste au-dessus. Le mécanisme existait déjà ailleurs dans le dépôt
(`set-env.mjs`) ; il manquait là où il comptait le plus.

**Ce que ces deux cas ont en commun** : un commentaire décrivait l'intention, et personne
n'avait vérifié que le code la servait. C'est la même famille que le garde-fou Bash (D-036)
et que les en-têtes de sécurité (D-034) — une affirmation écrite une fois, jamais éprouvée.
## D-038 — Configurations mortes : les retirer, ou les rendre structurelles

**Date** : 2026-08-06
**Contexte** : un audit externe a relevé huit configurations qui ne faisaient rien, ou qui
décrivaient un état révolu. Prises une à une, elles sont mineures. Prises ensemble, elles
forment un motif : **du texte que personne n'exécute finit par mentir**.

**Une procédure qui aurait égaré un agent.**
`.claude/skills/release-readiness/SKILL.md` affirmait que le build complet nécessite
`BASEHUB_TOKEN`. C'est une procédure qu'un agent **suit** au moment d'une livraison : elle
l'aurait envoyé chercher un jeton supprimé depuis D-031. `README.md` portait la même
affirmation, contredite vingt et une lignes plus bas. La PR #29 prétendait avoir corrigé
les références périmées et avait manqué celle-ci.

**Deux fichiers de configuration pointant vers un fichier supprimé** :
`biome.jsonc` et `.semgrepignore` référençaient `packages/cms/basehub-types.d.ts`.

**Un `overrides` silencieusement ignoré.** `package.json` en portait un sur `parse5`, au
format npm — que **pnpm ne lit pas**. Deux versions coexistaient malgré lui (7.3.0 et
8.0.1), ce qu'un override effectif interdit. Retiré plutôt que déplacé : `parse5` ne figure
dans aucune alerte, et forcer une version sans besoin mesuré est une contrainte gratuite.
Un avertissement dans `pnpm-workspace.yaml` empêche d'en réintroduire un au mauvais
endroit.

**Une sortie de cache qui ne correspondait à rien.** `turbo.json` déclarait `.react-email/**`
alors que `apps/email` écrit dans `.cache/export` — le cache de ce workspace ne restituait
donc jamais rien.

**Trois contrôles, une seule hypothèse de nommage.** `.env.staging` échappait
simultanément à `.gitignore`, au `deny` de `.claude/settings.json` et aux `SECRET_PATHS` du
garde-fou : les trois énuméraient des suffixes. Deux sont désormais **structurels** —
`.gitignore` ignore `.env.*` en préservant l'exemple par négation, et le garde-fou couvre
toute variante, `.env.example` étant écarté explicitement.

Le troisième reste une énumération, et c'est une limite assumée : le langage de motifs de
`settings.json` **ne sait pas exprimer une exception**. Un `Read(**/.env.*)` bloquait aussi
`.env.example`, fichier versionné et légitimement lisible — je l'ai constaté en me
l'interdisant à moi-même dans la foulée. La liste couvre donc les noms réalistes, et la
protection de fond vit dans le garde-fou, qui s'applique à toute commande.

**Deux variables documentées que personne ne lit.** `KNOCK_API_KEY` et
`KNOCK_FEED_CHANNEL_ID` figuraient dans les trois `.env.example` ; `packages/notifications`
lit `KNOCK_SECRET_API_KEY`, `NEXT_PUBLIC_KNOCK_API_KEY` et
`NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`. Exactement le défaut de D-028 pour BetterStack, sur un
autre service. Les noms morts sont retirés, et seule `apps/app` — la seule à utiliser le
package — conserve les vrais.

**Un resserrement assumé** : l'élargissement des `SECRET_PATHS` fait désormais refuser
`cp .env.example .env.local.tmp`. La destination contiendra du contenu d'environnement ;
l'attente inverse figurait dans la suite de tests, elle est corrigée. 87 cas.
## D-037 — Aucun artefact pour les parcours qui manipulent des identifiants

**Date** : 2026-08-06
**Contexte** : `ci.yml` portait ce commentaire — « les rapports peuvent contenir des
captures d'écran : ne jamais y laisser de secret ». Il anticipait les captures et
sous-estimait tout le reste.

Une **trace** Playwright enregistre les en-têtes **et les corps** des requêtes. Le parcours
authentifié y laisse donc le `POST` de connexion Clerk — avec le mot de passe du compte de
test, qui est un secret de dépôt — et le `Set-Cookie` de session. La **vidéo** et les
**captures** montrent le code de vérification, saisi dans un champ texte ordinaire, pas un
champ masqué.

Ces artefacts sont téléversés à chaque exécution, et **GitHub ne caviarde jamais le contenu
d'un artefact** : il ne masque que les journaux. Tout collaborateur du dépôt pouvait les
télécharger, sept jours durant.

**Décision** : couper trace, vidéo et captures **pour ce seul parcours**, avec
`test.use({ trace: "off", video: "off", screenshot: "off" })`.

Le choix est délibérément chirurgical. Tout désactiver en CI aurait coûté cher : c'est
précisément le rapport Playwright qui a permis de diagnostiquer, la veille, la
configuration Clerk divergente et le faux positif du contrôle de refus. Les parcours
anonymes n'émettent aucun identifiant et gardent donc leur valeur de diagnostic.

**Une convention ne tient pas.** Celui qui ajoutera le prochain parcours authentifié ne
lira pas le commentaire de `ci.yml`. `apps/api/__tests__/e2e-artifacts.test.ts` rend la
règle exécutoire : toute spec qui lit `E2E_USER_PASSWORD` ou `E2E_USER_OTP` doit désactiver
les trois artefacts. Vu échouer après retrait de la directive.

**Ce qui reste vrai** : la rétention est de sept jours, le dépôt est privé, et le compte est
dédié aux tests. Le périmètre était borné — mais `CLERK_SECRET_KEY` transite dans le même
job, et un mot de passe de compte de test reste un secret de dépôt.
## D-036 — Le garde-fou Bash réparé : six défauts, aucun n'exigeait d'obscurcissement

**Date** : 2026-08-06
**Contexte** : R-016 classait ce garde-fou en « accepté », au motif qu'un contournement
demandait un **obscurcissement déterminé** — encodage, chaîne construite. Un audit externe
a envoyé 34 formulations : **29 sont passées**, et aucune n'était obscurcie.

**Les six défauts, et ce qu'ils avaient en commun** :

| Défaut | Ce qui passait |
| --- | --- |
| Tout jeton entre guillemets était ignoré | `rm "-rf" /chemin`, `git "push" "--force"`, `docker compose down "-v"` |
| Seuls les chemins **absolus** comptaient pour le bac à sable | `rm -rf /tmp/keep ~/Documents` |
| Le corps de heredoc était effacé **depuis le `<<`** | `cat <<'EOF' && rm -rf /x` — la commande disparaissait de l'analyse |
| `(` et `{` n'étaient pas des séparateurs | `(rm -rf /x)` devenait le jeton `(rm` |
| Lecteurs manquants | `hexdump`, `openssl`, `rev`, `split`, `shasum`, `ditto` |
| Destructions manquantes | `shred`, `truncate -s 0` |

Le cas du heredoc est le pire : le garde-fou ne **ratait** pas la commande, il l'**effaçait
de sa propre vue** puis répondait « autorisé ». Un garde-fou qui se rend aveugle et
l'affirme est pire que pas de garde-fou.

**Les corrections** :

Le critère « entre guillemets » est remplacé par le critère **espacement**. Les guillemets
avaient été écartés pour qu'un message de commit parlant de `rm -rf` ne déclenche rien —
l'intention était bonne, le critère mauvais. Un argument réel ne contient pas d'espace ;
une phrase en contient toujours. `"-rf"` compte, `"docs: git push --force"` reste du texte.

Le bac à sable considère désormais **tous** les arguments non-drapeaux, après expansion du
`~` et résolution depuis le dossier courant. Un seul chemin hors zone réarme la règle.

Le corps de heredoc ne commence qu'à la **ligne suivante** : la fin de la ligne d'ouverture
est conservée et analysée. Les groupes deviennent des séparateurs d'invocation.

**La suite de tests passe de 85 à 113 cas.** C'est le vrai enseignement : les 85 cas
précédents ne contenaient **aucun** drapeau entre guillemets. Ils éprouvaient ce que
l'auteur avait déjà en tête — le contrôle et son test venaient de la même idée.

**Un cas de test écrit de travers, corrigé** : j'avais inscrit `rm -rf ~/../../tmp/hors-zone`
comme devant être refusé. Il est légitimement autorisé — ce chemin résout dans le
temporaire. Le garde-fou avait raison, mon attente était fausse.

**La limite est requalifiée, pas supprimée.** Ce n'est toujours pas une frontière de
sécurité : un encodage, une variable construite à l'exécution ou un interpréteur tiers
passeront. Mais R-016 ne peut plus dire « il faut être déterminé » — c'était faux, et
`rm -rf /tmp/x ~/Documents` est une frappe ordinaire, pas une attaque.
## D-035 — Le filtre Sentry raisonne par mot, plus par chaîne entière

**Date** : 2026-08-06
**Contexte** : D-026 affirmait « une chaîne de requête ne sort pas, **où qu'elle se
trouve** ». C'était faux. L'expression était **ancrée** :
`/^(?:https?:\/\/|\/)[^\s]*\?/` — elle ne reconnaissait une URL que si celle-ci
**commençait** la chaîne.

Un audit externe l'a mesuré le 2026-08-06. Sortaient intacts :

| Champ | Contenu |
| --- | --- |
| `message` | `fetch failed: https://api/reset?token=SECRET` |
| `exception.values[].value` | `Error at /callback?code=SECRET returned 500` |
| `breadcrumbs[].message` | `GET api.exemple.com/v1/x?key=SECRET` |

Le deuxième est le pire : `exception.values[].value` est le champ où un jeton a le plus de
chances d'atterrir, parce qu'un message d'erreur de `fetch` embarque l'URL appelée. À
`tracesSampleRate: 1`, c'est à chaque requête.

**Pourquoi les tests ne l'avaient pas vu** : ils n'utilisaient qu'une charge utile où les
URL étaient **seules dans leur champ** — exactement la forme mesurée au collecteur la
veille. Le test reproduisait la mesure, il ne l'élargissait pas.

**Décision** : raisonner **mot par mot** plutôt que sur la chaîne entière. Un mot est
suspect s'il contient un `?` et ressemble à une adresse — schéma explicite, ou simple
présence d'un `/`, ce qui couvre `api.exemple.com/v1/x?cle=…` sans schéma. Le reste du
texte est conservé intégralement : ponctuation, espacement, mots voisins.

**Second trou, corrigé aussi** : `MAX_DEPTH = 12` servait à la fois de borne de récursion
**et** de protection contre les cycles. Au-delà de douze niveaux, une valeur ressortait
intacte. Les cycles sont désormais traités par un `WeakSet`, et la borne passe à 64 — elle
ne protège plus que d'un objet pathologique.

**Vérifié** : neuf tests, dont quatre nouveaux portant sur la charge utile de l'audit, la
profondeur, les cycles, et la préservation du texte autour de l'URL. Le test central a été
**vu échouer** après rétablissement de l'ancrage fautif, et repasser après correction.

**Effet de bord assumé** : un mot très long contenant à la fois `/` et `?` — du JSON
sérialisé sans espaces — sera tronqué à son premier `?`. On perd du contexte plutôt que de
laisser fuir un jeton.
## D-034 — Les en-têtes de sécurité, enfin mesurés — et absents de deux apps sur trois

**Date** : 2026-08-06
**Contexte** : `SECURITY_MODEL.md` déclarait Nosecone « actif » depuis le premier jour.
Personne n'avait jamais regardé ce qui sortait réellement. Un audit externe l'a fait.

**Constaté, puis reproduit** :

| Application | En-têtes servis avant |
| --- | --- |
| `apps/app` | l'ensemble complet |
| `apps/web` | **aucun** |
| `apps/api` | **aucun** |

**Deux causes distinctes.** `apps/web/proxy.ts` faisait
`return middlewareResponse || headersResponse`. Le middleware d'internationalisation
renvoie **toujours** quelque chose — une réécriture pour `/`, une redirection pour
`/en/...` — donc la réponse portant les en-têtes était systématiquement jetée. Un `||` a
suffi à désarmer tout le dispositif sur le site public, celui qui reçoit justement le
trafic anonyme. Et `apps/api` n'avait **aucun proxy** : ses webhooks, son `/health` et sa
tâche planifiée répondaient sans le moindre en-tête.

**Décision** : compléter les en-têtes de la réponse d'i18n au lieu de la remplacer, et
doter `apps/api` de son propre proxy. `poweredByHeader: false` au passage — `X-Powered-By`
annonçait la pile sans contrepartie.

**Mesuré après correction**, build de production, requête réelle :

- `apps/web` sur `/en`, soit **une redirection 307** — le cas exact qui échouait :
  `strict-transport-security`, `x-frame-options`, `x-content-type-options`,
  `referrer-policy`, les trois `cross-origin-*`, `x-permitted-cross-domain-policies`.
  Aucun `x-powered-by`.
- `apps/api` sur `/health` : le même ensemble.

**Un contrôle durable, pas une case cochée** : `e2e/tests/security-headers.spec.ts`
interroge l'application en marche et lit les en-têtes, avec un cas dédié à la redirection.
Il ne couvre que `apps/app` — la suite e2e ne démarre qu'une application (R-026).

**Ce que je ne corrige pas, et qui est plus grave que ce qui précède** : la **CSP est
désactivée** sur les trois apps, par configuration héritée du template, et aucun document
ne le signalait. Elle ne peut pas être générique : elle se rédige à partir des origines
réellement utilisées — Clerk, Sentry, PostHog, Vercel. Devenu **R-025**, à traiter avant
toute mise en service.

**Note de méthode** : mesurer a exigé de fabriquer une clé Clerk locale non fonctionnelle,
parce que la graine renvoie `500` sur toutes les routes sans clé. C'est le constat n°5 de
l'audit, traité séparément — mais il explique pourquoi personne n'avait jamais vu ces
en-têtes : il fallait d'abord franchir un mur.

**Effet de bord relevé par le contrôle de frontières** : `apps/api` importait
`@repo/security` sans le déclarer. `pnpm boundaries` l'a refusé — le garde-fou a fonctionné.
## D-033 — Le contrôle d'autorisation vit dans la route, pas dans le layout

**Date** : 2026-08-06
**Contexte** : un audit externe a démontré que le « plancher » de D-024 ne tenait pas.

**Ce qui a été constaté** — reproduit et confirmé :

| Cas | Test statique | Réalité |
| --- | --- | --- |
| `route.ts` **sans aucun contrôle** sous `(authenticated)` | **3/3 verts** | `200` à un appel anonyme, `userId: null` |
| `auth()` retiré de `search/page.tsx` | **3/3 verts** | — |

**La cause** : `isProtected` remontait les `layout.tsx` parents. Comme
`(authenticated)/layout.tsx` appelle `currentUser()`, **toute** route sous ce groupe était
réputée protégée, quel que soit son contenu.

Deux erreurs distinctes dans cette remontée :

1. Un **route handler n'exécute jamais de layout**. Les layouts appartiennent au rendu
   React, pas au traitement d'une requête HTTP. Le crédit était purement imaginaire.
2. Même pour une **page**, un layout n'est pas une autorisation : Next évalue pages et
   layouts **en parallèle**, donc une lecture de données peut partir avant la redirection.
   `.claude/rules/security.md` le disait déjà — « au plus près de l'accès aux données » —
   et le commentaire de `(authenticated)/page.tsx` l'expliquait mot pour mot. Le test ne
   faisait pas respecter la règle que le dépôt s'était donnée.

**Décision** : le contrôle doit se trouver **dans le fichier de la route**. Aucun crédit
hérité, ni pour une page, ni pour un route handler.

**Conséquence immédiate** : `(authenticated)/webhooks/page.tsx` n'avait aucun contrôle et
appelait Svix (`getAppPortal`) en s'appuyant sur le layout. Un contrôle `orgId` y a été
ajouté — c'était un défaut réel, pas une formalité de test.

**Second angle mort, même famille** : `toUrlPath` retirait les segments dynamiques.
`(authenticated)/items/[id]/page.tsx` devenait `/items`, une URL inexistante ; Playwright
recevait un `404`, que la liste des refus acceptait. Le test passait au vert **sans avoir
touché la route**. Sur une application multi-tenant, la ressource identifiée par un
paramètre est justement celle qu'il faut contrôler.

`toUrlPath` renvoie désormais `null` pour une route dynamique, et un test dédié **échoue**
en les nommant : fournir une valeur d'exemple, ou assumer explicitement l'absence de
contrôle d'exécution. Le silence n'est plus une option.

**Ce que cet épisode enseigne** : le contrôle, son test, et l'idée derrière les deux
venaient de la même personne. Le test confirmait l'intention au lieu d'éprouver le
comportement. C'est le motif commun des trois constats les plus graves de cet audit.

---

## D-032 — Le package IA est gardé, et enfin exécuté

**Date** : 2026-08-05
**Contexte** : `@repo/ai` n'est importé par aucune application. Après le retrait de BaseHub
(D-031), la tentation était de le supprimer pour la même raison. **Le rapprochement était
faux.**

BaseHub coûtait cher parce qu'il **bloquait la chaîne** : sans jeton, `basehub build`
échouait, donc `apps/web` n'était pas construit en CI. Coût mesuré de `@repo/ai` :

| Mesure | Valeur |
| --- | --- |
| Alertes de vulnérabilité attribuables | **zéro** — les 60 viennent de `hono` (32), `undici` (12), `postcss`, `lodash`, `sharp` |
| Effet sur le build et la CI | **aucun** |
| Taille | 5 fichiers source |

**Décision** : le garder. Une barre de recherche, un assistant, une classification — le
besoin est probable, et le coût mesuré est proche de zéro. Le retirer plus tard resterait
trivial : aucune application ne l'importe, contrairement à BaseHub qui touchait sept
fichiers.

**Mais le garder inerte n'était pas tenable** : il compile, donc il a l'air de marcher. D-004
raconte que l'AI SDK v6 avait cassé son API — la correction a été écrite **à l'aveugle**,
faute de clé OpenAI. C'est exactement le piège dans lequel la graine est tombée cinq fois
aujourd'hui : Clerk, Neon, Sentry, BetterStack, Stripe.

**Le package est donc éprouvé**, sans compte, sans clé et sans coût : un serveur local
compatible OpenAI reçoit l'appel. `createOpenAI` se rabat sur `OPENAI_BASE_URL` lorsqu'aucune
URL n'est passée, ce que fait `lib/models.ts` — la porte était déjà là.

Trois tests : le module produit du texte, il adresse bien `gpt-4o-mini` sur un chemin
versionné, et il transmet la clé en en-tête `Authorization`. Le troisième a d'abord été
écrit de travers — son nom annonçait la clé, son assertion comptait les requêtes. Corrigé :
un test dont le nom ne décrit pas ce qu'il vérifie est pire qu'aucun test.

**Conséquence** : `vitest` devient une dépendance de développement de `packages/ai`, même
version que partout ailleurs. La tâche `test` de Turborepo le prend en charge sans autre
changement.

**Ce que cela prouve** : le module se charge, construit un modèle, émet une requête conforme
et sait lire la réponse — donc les correctifs de D-004 tiennent à l'exécution.
**Ce que cela ne prouve pas** : qu'OpenAI accepte cet appel. Comme pour BetterStack, on
constate ce qui part et sa forme, pas ce que le fournisseur en fait.

Ce test attrapera la prochaine dérive du SDK, qui viendra.

---

## D-031 — BaseHub retiré, pages légales écrites en dur

**Date** : 2026-08-05
**Contexte** : BaseHub alimentait la page d'accueil, le blog, les pages légales, le pied de
page et le plan du site de `apps/web`. Il n'a jamais été activé : `basehub build` échoue
sans jeton, donc `apps/web` n'était **pas construit en CI** (R-007) — non vérifié depuis la
création du dépôt.

**Ce que la mise en route aurait coûté** : un compte, un dépôt créé **depuis le modèle
next-forge** — un dépôt vide n'a pas les types interrogés (`blog.posts`, `legalPages`), le
build échouerait —, un jeton, et du contenu à écrire.

**Ce qu'un CMS apporte** : permettre à quelqu'un **qui ne touche pas au code** de modifier
le contenu sans redéployer. Personne n'est dans ce cas ici. Et pour un contenu publié par
automatisation, l'argument s'inverse : des fichiers dans le dépôt donnent gratuitement la
relecture avant publication (une pull request), le versionnement et le retour arrière, là
où un CMS exigerait un jeton **en écriture** et un flux de validation à construire.

**Décision** : retirer `packages/cms`, supprimer le blog, écrire les pages légales en
composants statiques.

**Conséquences** :

- `apps/web` **se construit sans aucun jeton**. Le build complet entre dans le job
  `quality` et tourne à chaque exécution. Le job `build-full` et la variable
  `ENABLE_FULL_BUILD` disparaissent. **R-007 est fermé** ;
- une dépendance de service en moins (R-009), un secret en moins ;
- les liens « Privacy » et « Terms » du widget Clerk, **cassés jusqu'ici**, mènent
  désormais quelque part ;
- deux endroits à tenir à jour quand une page légale est ajoutée : le pied de page et le
  plan du site. C'est écrit en commentaire aux deux endroits — le parcours de dossiers du
  plan du site ne descend que d'un niveau et manquerait la route imbriquée.

**Ce que les pages contiennent** : la **structure** d'une politique de confidentialité et
de conditions d'utilisation, avec un bandeau visible indiquant qu'elles ne sont pas
rédigées. Écrire un faux texte juridique d'allure crédible aurait été pire que l'absence de
page : cela engage sans que personne l'ait voulu. R-024 suit leur rédaction.

**Réversible** : BaseHub est un package, pas une fondation. Le jour où un rédacteur existe,
il se rebranche — les sept fichiers concernés sont identifiés dans ce commit.

---

## D-030 — Stripe vérifié en livraison réelle

**Date** : 2026-08-05
**Contexte** : D-022 avait éprouvé la vérification de signature contre la **spécification**,
en signant les corps de test à la main. Restait à savoir si une signature réellement émise
par Stripe passe, et si l'idempotence (D-023) tient avec de vrais identifiants d'événement.

**Méthode** : clé de test dans un projet jetable, `stripe listen --forward-to` vers
`apps/api`, événements provoqués par `stripe trigger`. Base **Neon**, pour que la mémoire
d'idempotence soit celle d'un vrai serveur et non d'un conteneur local.

| Contrôle | Résultat |
| --- | --- |
| Signature émise par Stripe | **200** — 7 événements distincts acceptés |
| Signature forgée | **400** |
| Aucune signature | **400** |
| Rejeu spontané par Stripe | « événement déjà traité », **non retraité** |
| Rejeu explicite (`stripe events resend`) | idem |
| Table `WebhookEvent` | **7 lignes, 7 identifiants distincts** malgré les rejeux |
| Erreurs de traitement ou de réservation | **aucune** |

**Ce que cela confirme** : les correctifs de D-022 (le `400` au lieu du `500`, qui évitait
des réessais inutiles de Stripe) et l'idempotence de D-023 fonctionnent en conditions
réelles, pas seulement contre des corps signés à la main.

**Ce qui reste non exercé, et doit être dit** :

- le **rapprochement client** : `handleCheckoutSessionCompleted` a bien été appelé, mais
  aucun utilisateur Clerk ne porte de `stripeCustomerId`. La branche qui balaie les comptes
  (R-020) n'a donc jamais tourné pour de vrai ;
- **Connect** : rien n'est implémenté (D-029), donc rien n'est vérifié — ni le routage par
  `event.account`, ni les charges directes ;
- la **facturation** elle-même : aucun abonnement, aucun paiement récurrent.

R-006 perd sa dernière mention de Stripe. Restent non exécutés : **BaseHub** et le
package **IA**.
---

## D-029 — Paiements : Billing pour notre revenu, Connect **Standard** pour celui des clients

**Date** : 2026-08-05
**Statut** : direction arrêtée, **rien n'est implémenté**. Aucun code de cette décision
n'existe encore dans le dépôt.

**Contexte** : deux besoins de paiement se ressemblent et n'ont rien à voir.

1. Nous facturons nos clients, mensuellement. L'argent nous appartient.
2. Nos clients encaissent **leurs** clients. L'argent ne nous appartient pas.

Le second fait de nous une **plateforme**, avec les obligations et l'exposition qui vont
avec. Le scénario examiné pour trancher était une plateforme de gestion de restaurants —
les restaurants encaissent les convives. ⚠️ Ce scénario a servi à raisonner ; **il
n'établit pas le domaine du produit**, qui reste indéfini (R-001). Si c'est bien le produit,
c'est au propriétaire de renseigner `docs/PROJECT_CONTEXT.md`.

**Décision** :

| Flux | Produit Stripe | Où va l'argent |
| --- | --- | --- |
| notre abonnement mensuel | **Billing**, sur notre compte | notre solde |
| paiement du client final | **Connect Standard**, charges **directes** | directement au client, jamais par notre solde |

Les deux flux restent **séparés**. C'est cette séparation qui rend la comptabilité
lisible : notre chiffre d'affaires est constitué de nos abonnements, et les fonds de nos
clients ne transitent jamais par notre solde.

**Pourquoi Standard, et pas Express** — c'est l'arbitrage central, et il porte sur une
seule question : **qui absorbe un solde négatif**.

Une contestation de paiement peut arriver jusqu'à 120 jours après la transaction, alors que
les fonds ont été versés depuis longtemps. Si le compte du client est vide ou fermé,
quelqu'un absorbe la perte. En Express et en Custom, c'est la plateforme. En Standard, c'est
le client, qui a son propre contrat avec Stripe.

Le scénario qui décide n'est pas le client honnête en difficulté, mais le **faux client** :
inscription, encaissement avec des cartes volées, versement, disparition, contestations un
mois plus tard. En Express, c'est notre trésorerie — et le contrôle de qui l'on embarque
devient un dispositif financier, pas une formalité.

Cette exposition n'est **pas mesurable** aujourd'hui : ni volume, ni typologie de clients,
ni historique. On ne provisionne pas un risque qu'on ne sait pas chiffrer. Standard le
supprime.

**Ce que Standard coûte, et qui est assumé** :

- inscription plus lourde — création d'un vrai compte Stripe : pièce d'identité, numéro
  d'entreprise, IBAN. Une partie des clients abandonnera en route ;
- aucun levier de versement différé, aucune réserve ;
- le client peut **nous déconnecter** quand il veut : toute fonctionnalité fondée sur son
  historique de transactions s'éteint ce jour-là ;
- image de marque : inscription, e-mails et tableau de bord sont ceux de Stripe.

**Ce que Standard apporte** : aucune responsabilité sur les pertes, aucune obligation de
vérification d'identité de notre côté, les frais Stripe payés par le client — donc une
tarification plus simple — et le cas fréquent du client **qui a déjà un compte Stripe**,
pour qui l'inscription se réduit à une autorisation.

**Conséquences pour la graine** — aucune n'est traitée à ce jour :

- un `stripeAccountId` **sur l'organisation**, donc une entité de domaine que la graine n'a
  pas (R-001). Connect ne peut pas être écrit avant le modèle métier ;
- un routage des webhooks par le champ `account` de l'événement : sans lui, un paiement
  encaissé par un client serait traité comme le nôtre. Le gestionnaire actuel ignore
  totalement cette notion ;
- **R-020 devient faux** en Connect : retrouver un utilisateur à partir d'un identifiant
  client Stripe suppose un espace d'identifiants unique, ce que Connect n'a pas — chaque
  compte connecté a le sien.

**Séquencement** : Billing d'abord, il ne dépend d'aucune entité métier. Connect ensuite,
une fois les entités connues.

**Ce qui reste à décider** : prendre ou non une commission par transaction
(`application_fee_amount`) — réversible, sans migration ; et le moment d'ouvrir Connect.

**Ce qui n'est pas réversible sans douleur** : qui est le commerçant et qui porte les
pertes. C'est contractuel vis-à-vis des clients finaux, cela touche les relevés bancaires
et les litiges, et en changer impose de faire repasser chaque client par une inscription.
Standard → Express est particulièrement pénible : le compte appartient au client, pas à
nous.

**Réserves** : Stripe décrit désormais Connect par des **propriétés de contrôle** — qui
porte les pertes, qui paie les frais, qui accède au tableau de bord — plutôt que par les
trois types historiques, et l'inscription hébergée s'est élargie au-delà de l'OAuth.
Le raisonnement tient, les termes exacts et les combinaisons autorisées sont à vérifier
dans la documentation à jour avant de figer le tunnel d'inscription. Les questions de
responsabilité réglementaire relèvent de Stripe et d'un conseil, pas de ce document.

---

## D-028 — BetterStack : deux produits, deux configurations, une seule présente

**Date** : 2026-08-05
**Contexte** : `packages/observability` déclarait `BETTERSTACK_API_KEY` et
`BETTERSTACK_URL`, et `docs/DEPLOYMENT.md` les présentait comme la configuration de la
journalisation. Elles ne le sont pas : elles servent le produit **Uptime** — clé d'API des
moniteurs et adresse de la page de statut, lues par `status/index.tsx` et affichées dans le
pied de page public.

La journalisation passe par `@logtail/next`, qui ne lit **aucune de ces orthographes**. La
chaîne `BETTERSTACK` n'apparaît nulle part dans son code. Il attend
`BETTER_STACK_SOURCE_TOKEN` et `BETTER_STACK_INGESTING_URL`
(`dist/platform/generic.js`) — **absentes du dépôt depuis l'origine** — et **se rabat
silencieusement sur un affichage console** quand elles manquent.

Conséquence : un projet qui renseignait consciencieusement les variables documentées
croyait envoyer ses journaux. Rien ne partait, et rien ne le signalait.

**Erreur d'analyse corrigée en chemin** : j'ai d'abord conclu que les deux variables
existantes étaient mortes, et je les ai renommées. Le typecheck a immédiatement cassé sur
`status/index.tsx`. Elles n'étaient pas mortes — elles étaient **mal documentées**. La
correction n'est donc pas un renommage mais un **ajout**, et le maintien des deux familles
côte à côte, chacune commentée avec le produit qu'elle sert.

**Mesure**, au collecteur local, même méthode que pour Sentry (D-026) :

| Variables posées | Requêtes reçues |
| --- | --- |
| `BETTERSTACK_API_KEY` + `BETTERSTACK_URL` (celles de la graine) | **0** |
| `BETTER_STACK_SOURCE_TOKEN` + `BETTER_STACK_INGESTING_URL` | **1** |

**Décision** : ajouter `BETTER_STACK_SOURCE_TOKEN` et `BETTER_STACK_INGESTING_URL` à
`keys.ts` et aux trois `.env.example`, à côté des variables Uptime, chaque famille
commentée avec le produit qu'elle sert. Deux produits distincts d'un même fournisseur
méritaient d'être distingués ; les confondre a coûté une intégration silencieusement
inopérante.

**Garde-fou** : `apps/api/__tests__/observability-keys.test.ts` exige les quatre variables
et empêche qu'une famille chasse l'autre. Il ne teste pas le SDK — il teste que ce que nous
**déclarons** correspond à ce qu'il lit, exactement là où la faute s'était logée.

**Ce que la mesure a montré d'autre** : une fois correctement configuré, le SDK expédie le
message **et tous les champs structurés en clair**. Aucun filtrage, aucune rédaction. La
règle « ne jamais journaliser de donnée sensible » cesse d'être une hygiène locale : elle
protège un flux vers un tiers. Même constat que R-022 pour le canal `log` de Sentry.

**Symétrie utile à retenir** : sur Sentry, on croyait que rien ne partait et beaucoup
partait. Sur BetterStack, on croyait que tout partait et rien ne partait. Deux erreurs
opposées, une seule cause — une affirmation jamais vérifiée.

**Limite** : mesuré contre un collecteur local, pas contre BetterStack. Ce qui est prouvé,
c'est *qu'une requête part et ce qu'elle contient*, pas que le service l'accepte.

---

## D-027 — Sauvegarde : un mécanisme répété, pas une procédure écrite

**Date** : 2026-08-05
**Contexte** : R-004 — gravité **critique** — était intact depuis l'initialisation. Sa
formulation portait le mot décisif : « ni **testée** ». Une procédure de restauration
jamais exécutée ne vaut rien, et c'est le seul incident dont aucun correctif ne rattrape.

**Décision** : `pnpm db:backup` et `pnpm db:restore`, exécutant `pg_dump`/`pg_restore`
**dans le conteneur** de `compose.yml`. Deux raisons : aucun client Postgres à installer sur
chaque poste, et surtout aucun risque de client plus ancien que le serveur — `pg_dump`
refuse alors de sauvegarder. L'URL passe par l'environnement du conteneur, jamais par une
ligne de commande visible de tout le système.

**Répétition exécutée** — restaurer **ailleurs** que sur la source, seule façon de prouver
une sauvegarde sans mettre en jeu ce qu'elle protège :

| Étape | Résultat |
| --- | --- |
| `db:backup` depuis **Neon** (via le pooler) | 4124 octets, permissions `600` |
| Tables supprimées sur la base locale | `DROP TABLE` |
| `db:restore --to local --yes` | terminée sans erreur |
| Contrôle | tables **et** historique des migrations retrouvés |

**Ce que la répétition a corrigé** : le premier essai annonçait « Restauration échouée »
alors que tout était restauré. Un dump Neon emporte des privilèges propres à l'hébergeur
(`GRANT ... TO neon_superuser`) qu'aucune autre base n'accepte ; `pg_restore` sort en erreur
pour deux instructions ignorées, sur un travail par ailleurs réussi. Corrigé par
`--no-owner --no-acl`, et le message distingue désormais échec complet et instruction
ignorée. **Un faux négatif est ici plus dangereux qu'un vrai échec** : en incident, il pousse
à renoncer à une restauration valide.

**Garde-fous** : cible explicite (`--to local` ou `--to database-url`, jamais de défaut),
`--yes` obligatoire après affichage de l'hôte et de la base, refus d'écraser une sauvegarde
existante, fichiers en `600` et `sauvegardes/` hors de Git. Cinq tests couvrent ces refus.

**Ce que cette décision ne règle pas** : la **politique**. Fréquence, rétention,
emplacement, délai de reprise, responsable — aucune de ces réponses n'est générique, toutes
dépendent de ce que le produit peut se permettre de perdre. Elles sont posées en questions
dans `docs/RECOVERY.md` et tracées en H-008. R-004 reste donc ouvert : le mécanisme est
éprouvé, la politique n'existe pas.

**Non mesuré** : la rétention de l'historique Neon, donc la fenêtre réelle de restauration
ponctuelle chez l'hébergeur.

---

## D-026 — Sentry : filtrer les deux canaux, pas seulement les erreurs

**Date** : 2026-08-05
**Contexte** : R-018 affirmait Sentry « bridé », R-010 notait que personne n'avait jamais
observé ce qui en sortait. Les deux tenaient sur la lecture du code, jamais sur une mesure.

**Méthode** : plutôt qu'ouvrir un compte Sentry et lire son interface, un **collecteur
local** — un serveur HTTP de vingt lignes — a reçu le DSN. Le SDK lui a envoyé ses
enveloppes, qu'on lit octet par octet. Aucun compte, aucune donnée sortie de la machine, et
une précision qu'aucune interface ne donne.

**Ce que la mesure a montré**, avec des marqueurs reconnaissables dans l'en-tête
`authorization`, le cookie, le corps et la chaîne d'URL :

| Canal | Verdict initial |
| --- | --- |
| `type=event` (erreur) | **correctement filtré** — `vars: null`, `request.headers/data: null` |
| `type=transaction` | **en-tête, cookie, corps et jeton d'URL, en clair** |
| runtime edge (proxy) | **aucun filtre**, et il voit toutes les requêtes |

`beforeSend` ne s'applique qu'aux **erreurs**. Les transactions exigent
`beforeSendTransaction`, absent. Avec `tracesSampleRate: 1`, c'est **chaque requête** —
erreur ou non — qui partait avec son en-tête d'autorisation et son cookie de session.

**Décision** : un filtre unique (`packages/observability/scrub.ts`), appliqué aux deux
canaux et aux trois runtimes. Un garde-fou qui ne couvre qu'une sortie sur trois donne une
fausse assurance — pire que pas de garde-fou.

Le filtre applique une **politique**, pas une liste de champs : aucune chaîne de requête ne
sort, où qu'elle se trouve. La première version ne vidait que `request.query_string` ; la
re-mesure a montré le jeton survivant dans `request.url`,
`contexts.trace.data["http.target"]` et `contexts.nextjs.request_path`. Une liste de champs
aurait été à refaire à chaque version du SDK.

**Re-mesuré après correctif** : les quatre marqueurs ont disparu ; chemin, méthode,
transaction, message et pile sont conservés — filtrer n'est utile que si le diagnostic
reste possible, sans quoi le filtre finit contourné.

**Deux corrections de cohérence au passage** : le client expédiait chaque `console.log` du
navigateur alors que le serveur excluait explicitement ce niveau, en le justifiant ; et
`DEPLOYMENT.md` affirmait « Sentry activé uniquement quand `VERCEL` est définie ». C'est
faux : seul le **plugin de build** l'est. `instrumentation.ts` initialise le SDK dès qu'un
DSN existe. Un développeur qui renseigne un DSN en local envoie donc à Sentry en croyant
que non.

**Limite assumée** : le canal `log` (`enableLogs: true`) expédie tout `console.error` ou
`console.warn` sans passer par ces filtres. Aucune correction posée — je n'ai pas mesuré sa
forme. Devenu R-022.

---

## D-025 — Neon vérifié : le pilote standard suffit, `directUrl` n'est pas nécessaire

**Date** : 2026-08-05
**Contexte** : D-021 avait remplacé l'adaptateur serverless de Neon par le pilote Postgres
standard, en **attendant** que Neon accepte des connexions classiques. C'était le mode
documenté par le fournisseur, mais une attente n'est pas une mesure (R-019). Deux craintes
étaient formulées : que le TLS ne soit pas négocié, et que les migrations échouent sur le
point d'accès mutualisé (« pooler »).

**Mesure**, sur un projet Neon gratuit et un projet jetable (D-018), via la chaîne
**pooled** :

| Contrôle | Résultat |
| --- | --- |
| `pnpm migrate:status` | connecté, TLS négocié |
| `pnpm migrate:deploy` | migration appliquée **par le pooler** |
| Requête applicative réelle (`page.findMany`) | `{ ok: true }` |
| `/` sans session | `307 → /sign-in` |

**Conséquences** : aucune des deux craintes ne se matérialise. Le `directUrl` de Prisma,
que j'annonçais probablement nécessaire, **ne l'est pas** pour ce schéma. Ne pas l'ajouter
par précaution : une option de configuration non justifiée par une mesure est une dette.

**Limite** : seules des migrations simples ont été exercées. Le pooler est un PgBouncer en
mode transaction ; une migration prenant un verrou consultatif peut encore échouer. Si cela
arrive, `directUrl` est la réponse — documentée ici pour ne pas la redécouvrir.

**Effet de bord relevé en préparation, devenu R-021** : `pg-connection-string` 2.14 traite
`sslmode=require` comme `verify-full`, donc **vérifie** le certificat. Le paquet annonce
qu'en `pg` 9 ce mode adoptera la sémantique libpq — chiffrer sans vérifier. La même chaîne
de connexion deviendra alors moins sûre, sans qu'aucune ligne de code ne change et sans
qu'aucun test n'échoue. C'est le genre de régression qu'une montée de version silencieuse
apporte ; le contrôle est à poser sur la PR Dependabot, pas dans le code.

---

## D-024 — Protection des routes : constater le refus, pas la présence d'un contrôle

**Date** : 2026-08-05
**Contexte** : D-019 avait doté R-013 d'un test statique — toute route doit porter un
contrôle d'autorisation ou figurer dans `PUBLIC_ROUTES`. Sa limite était écrite dès
l'origine : il constate la **présence** d'un contrôle, pas sa **justesse**. Un `auth()`
dont on ignore le résultat le satisfait.

**Décision** : ajouter un second test qui interroge l'application **en marche**. Chaque
route non déclarée publique reçoit une requête anonyme (`GET` et `POST`) et doit refuser —
redirection vers l'authentification, `401`, `403`, `404`, ou `405` si le verbe n'est pas
exposé. Le test statique est **conservé** : il est le plancher qui subsiste quand aucun
service tiers n'est configuré et que le job e2e ne tourne pas.

L'inventaire des routes et la liste des routes publiques vivent dans un module unique
(`apps/app/__tests__/routes.ts`) : deux listes auraient divergé, et la divergence serait
passée inaperçue.

**Conséquences — la démonstration** : une sonde a été posée, appelant `auth()` puis
ignorant son résultat.

| Test | Verdict sur la sonde |
| --- | --- |
| statique (présence) | **passe** — le contrôle existe |
| exécution (refus réel) | **échoue** — `/probe a répondu 200 à une requête anonyme : la route est exposée` |

Sonde retirée, les cinq routes protégées refusent toutes.

**Limite** : le test ne couvre que l'anonymat. L'isolation **entre organisations** — un
membre de A n'accède pas aux données de B — reste non testée : elle exige deux comptes de
test et un modèle de données. C'est l'invariant structurant du produit (R-001), et le
prochain à couvrir dès qu'une entité de domaine existera.

**Détail d'implémentation notable** : le module partagé ne peut pas utiliser
`import.meta.url`, car il est chargé par deux exécuteurs (vitest depuis `apps/app`,
Playwright depuis la racine). L'import échouait côté Playwright — qui signalait « aucun
test trouvé » plutôt qu'une erreur d'import, un silence qui aurait pu passer pour un succès.

---

## D-023 — Idempotence des webhooks : une contrainte de base, pas une vérification

**Date** : 2026-08-05
**Contexte** : R-012 était repoussé depuis l'origine au motif que l'idempotence « exige un
modèle de données que la graine n'a pas encore ». **C'était une erreur d'analyse** : elle
n'exige pas le modèle *métier*, seulement une table d'infrastructure. Le risque, lui, était
réel — un fournisseur rejoue dès qu'il doute d'une livraison, et pour un paiement les
conséquences le sont aussi.

**Décision** : un modèle `WebhookEvent` à clé primaire composite `(provider, eventId)`.
C'est la **contrainte de la base** qui décide : deux livraisons simultanées atteindraient
toutes deux un `findFirst` avant que l'une n'écrive — ce serait une course, pas une
garantie (`.claude/rules/database.md`).

Ordre imposé : **réserver avant de traiter**. Réserver après laisserait une fenêtre où un
rejeu passerait. Et **libérer si le traitement échoue** : sans cela, l'événement serait tenu
pour traité et le réessai ignoré — une perte silencieuse, l'inverse du but recherché.

**Clé retenue** : l'identifiant de **livraison**, pas celui de la ressource. Pour Stripe,
`event.id`. Pour Clerk, l'en-tête `svix-id` : Svix conserve le même d'un réessai à l'autre,
alors que `event.data.id` est partagé par tous les événements concernant la même ressource
— l'utiliser confondrait une création et une mise à jour du même utilisateur.

**Conséquences** : migration `20260805171114_webhook_events` (cinq lignes, relisible),
`apps/api/lib/idempotency.ts`, les deux routes câblées, 26 tests dans `apps/api`. Une base
injoignable renvoie `503` plutôt que de traiter sans mémoire : renoncer à l'idempotence en
silence serait pire que refuser.

Au passage, le webhook Clerk portait le même défaut que Stripe — absence de configuration
acquittée par un `200`, donc événement perdu sans trace. Il renvoie `503`.

**Limite** : rien ne purge la table. À volume réel, prévoir une rétention (les fournisseurs
cessent de réessayer bien avant quelques jours).

---

## D-022 — Le webhook Stripe éprouvé contre la spécification, pas contre sa bibliothèque

**Date** : 2026-08-05
**Contexte** : le webhook de paiement n'avait **aucun test** — relevé par l'audit du matin,
non traité. Le motif était structurel : `@repo/payments` importe `server-only`, qui lève
hors contexte serveur, donc le seul moyen de charger la route en test était de simuler le
client Stripe — c'est-à-dire de simuler la vérification de signature, la seule chose qui
mérite d'être testée.
**Décision** : neutraliser `server-only` par un alias vitest
(`apps/api/__tests__/stubs/server-only.ts`) pour que la route utilise le **vrai** client
Stripe, et signer les corps de test à la main selon le schéma publié
(`HMAC-SHA256` sur `timestamp.corps`). La route est ainsi confrontée à la spécification, et
non à la bibliothèque qui la vérifie — signer avec le SDK aurait bouclé la bibliothèque sur
elle-même.
**Conséquences** — 9 tests écrits, **7 rouges** au premier passage, chacun sur un défaut réel :

1. absence de configuration acquittée par un `200` : Stripe considérait l'événement traité,
   il était perdu sans trace — désormais `503` ;
2. signature absente, forgée ou corps modifié → `500`, donc **réessais** de Stripe pour une
   signature qui ne deviendra jamais valide — désormais `400` ;
3. la réponse renvoyait **l'événement entier** vers un tiers : identité du client, montant,
   adresse — désormais `{ ok: true }` ;
4. `getUserList` est paginé et n'était lu **que sur sa première page** : le rapprochement
   échouait en silence au-delà (R-020).

`apps/api` passe par ailleurs de `jsdom` à `node` : sous `jsdom`, `window` existe et la
validation d'environnement refuse toute variable serveur, se croyant côté client.

**Non couvert** : l'idempotence (R-012), et le comportement face à une livraison réelle de
Stripe, qui exige un compte.

---

## D-021 — Un seul pilote Postgres, partout

**Date** : 2026-08-05
**Contexte** : `packages/database` construisait son client avec `PrismaNeon`, l'adaptateur
serverless de Neon. Cet adaptateur parle un protocole **WebSocket propre à Neon**, pas le
protocole Postgres. Conséquence mesurée : sur la base locale de `docker compose`, `psql` et
`prisma migrate deploy` réussissent, et le transport Neon échoue. Autrement dit, les
migrations s'appliquaient et **aucune requête applicative ne pouvait aboutir** — ni en
local, ni en CI.

Invisible depuis l'origine : la seule page qui interroge la base est la page d'accueil
authentifiée, qui exige une session Clerk **et** une organisation. Ces conditions n'ont été
réunies que le 2026-08-05, en CI, où l'erreur est apparue sous la forme d'un `500` opaque.

**Décision** : remplacer `PrismaNeon` par `PrismaPg`, le pilote Postgres standard, dans
tous les environnements. Neon accepte les connexions Postgres classiques ; en environnement
serverless, utiliser son point d'accès « pooler ».
**Conséquences** : `@neondatabase/serverless`, `@prisma/adapter-neon`, `ws`, `@types/ws`,
`bufferutil` et `undici` (orphelin) sont retirés ; `@prisma/adapter-pg` et `pg` ajoutés.
Six dépendances en moins, une en plus.

**Ce qui a emporté la décision** : deux chemins de code auraient laissé la production sur
un transport que la CI n'exerce jamais. C'est exactement le piège constaté quelques heures
plus tôt avec les variables Clerk — la CI validait une application autrement configurée que
celle qu'on livre. Un seul chemin : ce qui est testé est ce qui tourne.

**Limite** : le comportement sur Neon lui-même n'a **pas** été vérifié — aucun compte Neon
n'existe à ce jour. Le pilote standard y est le mode de connexion documenté, mais c'est une
attente, pas une mesure. Voir R-019.

---

## D-020 — Versionner la migration initiale

**Date** : 2026-08-05
**Contexte** : `schema.prisma` décrivait `Page`, mais aucune migration n'était versionnée.
Trois conséquences, toutes invisibles jusqu'à la première connexion réussie : une base
fraîche n'avait aucune table, `pnpm migrate:deploy` n'appliquait rien dans un environnement
déployé, et le job e2e ne pouvait pas tester le parcours authentifié — la seule
alternative, `prisma db push`, est interdite par `.claude/rules/database.md` hors
prototypage local.
**Décision** : versionner `20260805135910_init` (création de `Page`). La graine décrit
désormais un schéma **reproductible partout**.
**Conséquences** : `migrate:deploy` applique la migration — vérifié sur la base locale, la
table est créée. `vibe0` continue d'appeler `migrate dev`, qui applique la migration
existante et n'en crée une nouvelle que si le schéma a été modifié.
**Objection considérée** : versionner une migration pour un modèle de démonstration
destiné à disparaître. Retenue quand même — un schéma qu'aucun environnement ne sait
recréer est un défaut plus grave qu'une migration initiale à remplacer. Quand `Page`
cédera la place au vrai modèle, la migration suivante se génère normalement.

---

## D-019 — R-013 : un test, pas un middleware

**Date** : 2026-08-05
**Contexte** : R-013 était avéré — une route posée hors du groupe `(authenticated)`
répondait `200` à un appel anonyme. Le réflexe est d'ajouter `auth.protect()` dans
`apps/app/proxy.ts`, avec une liste de routes publiques. Ce correctif a été écrit,
puis **retiré**.

Motif du retrait : à la première exécution, Clerk 7 a émis un avertissement de
dépréciation sur `createRouteMatcher`, en donnant précisément la raison qui fait R-013 —
la protection par correspondance de chemins « peut diverger du routage réel de Next.js et
laisser des ressources protégées joignables ». Le correctif aurait donc apporté une
confiance fausse, et disparaîtra à la prochaine version majeure du fournisseur. Sa
recommandation rejoint `.claude/rules/security.md` : contrôler au plus près de la donnée.

**Décision** : `proxy.ts` reste du **routage**, ce que ARCHITECTURE.md affirmait déjà.
L'autorisation reste dans les layouts, pages, route handlers et server actions. Le risque
réel — l'oubli — est traité par un test qui le rend **détectable** :
`apps/app/__tests__/route-protection.test.ts` parcourt `app/`, et échoue pour toute route
qui n'a ni contrôle d'autorisation (dans le fichier ou un layout parent) ni entrée
justifiée dans `PUBLIC_ROUTES`.

**Conséquences** : le test a été **vu échouer** sur le scénario exact de R-013 (`probe/route.ts`
sans contrôle), avec un message nommant la route et l'action à mener. Deux tests
l'accompagnent : une entrée périmée dans `PUBLIC_ROUTES` échoue aussi (une exception doit
rester examinée), et un jeu de routes vide échoue (sans quoi une erreur de chemin
rendrait le tout vert en n'analysant rien).

**Limite assumée** : ce test constate la *présence* d'un contrôle, pas sa *justesse*. Un
`auth()` dont on ignore le résultat le satisfait. Il ferme l'oubli, pas l'erreur.

---

## D-018 — Vérifier les services tiers sur un projet jetable, jamais sur la graine

**Date** : 2026-08-05
**Contexte** : quatre chemins restaient non exécutés faute de clés de service (R-006,
R-008, R-013, H-007). Les tester dans la graine y aurait introduit des clés, une
instance Clerk et une base peuplée — exactement le résidu que `project:init` s'efforce
d'éliminer (R-017).
**Décision** : créer un projet **jetable** avec `vibe0`, y saisir des clés de
développement, exécuter le parcours, puis reporter les seuls **constats** dans la graine
par pull request. Aucune clé, aucun identifiant, aucune donnée ne remonte.
**Conséquences** — la première exécution réelle a révélé quatre défauts qu'aucune
relecture n'avait vus, parce qu'aucun d'eux n'est visible sans franchir `/sign-in` :

1. `getByLabel(/password/i)` visait aussi le bouton « Show password » de Clerk, et
   `getByRole("button", {name: /continue|sign in/i})` aussi « Continue with Google » :
   Playwright refusait d'agir. Libellés désormais **ancrés**.
2. Clerk interpose une **vérification d'appareil** (code à usage unique) entre le mot de
   passe et la session — donc à chaque exécution en CI, où la machine est toujours neuve.
   Le test ne la connaissait pas ; il l'assume maintenant via `E2E_USER_OTP`.
3. Un refus du fournisseur se présentait comme « l'URL n'a pas changé », la vraie cause
   restant dans le rapport HTML. Le message du fournisseur est désormais relevé et jeté.
4. Aucune migration n'est versionnée : une base fraîche n'a **aucune table**, alors que
   la page d'accueil authentifiée interroge `Page`. `vibe0` applique maintenant le schéma
   après avoir démarré Postgres, et le test e2e recharge la page pour constater qu'elle
   ne renvoie pas une erreur serveur — quitter `/sign-in` ne prouvait rien.

Mesure obtenue : parcours authentifié **5/5**, et R-013 confirmé (une route hors du
groupe `(authenticated)` répond `200` à un anonyme). Ce qui reste non exécuté — Stripe,
BaseHub, Sentry, IA — le reste explicitement.

---

## D-017 — Garde-fou Bash : tokenisation, après deux contournements d'audit

**Date** : 2026-08-05
**Contexte** : deux audits successifs ont contourné le garde-fou. Le premier avec des
guillemets (8 formulations sur 11) : la version d'alors effaçait le *contenu* des
guillemets pour ignorer la prose, donc `cat ".env.local"` devenait invisible. La
réécriture suivante, à base de motifs ancrés au premier mot, a fermé ces 8 voies — le
second audit en a ouvert **16 autres** : substitution `$(…)`, enrobage `env`,
`bash -lc`, `docker-compose`, `mkfs.ext4`, `vim`, `git diff --no-index`, redirections…
Et 6 faux positifs bloquaient les messages de commit parlant du garde-fou lui-même.
**Décision** : abandonner l'analyse par expressions régulières sur texte brut. Un
tokeniseur (`lib/shell-tokens.mjs`) découpe la ligne en invocations ; un argument entre
guillemets est **un seul jeton**, jamais confondu avec une commande ; les substitutions
et interpréteurs imbriqués sont réinjectés et analysés ; les enrobages (`sudo`, `env`,
`pnpm exec`, `xargs`) sont dépliés jusqu'à la commande réelle. Les règles nomment leur
commande et n'inspectent que les **arguments**. `vercel` passe en liste blanche : tout
sauf `--help`/`--version`/`whoami` est refusé, car `vercel env pull` écrit les variables
de production sur disque.
**Vérifié** : 85 cas — les contournements des deux audits, les faux positifs, et le
travail courant. Trois versions à motifs sont tombées ; celle-ci se distingue par sa
structure, pas par ses motifs. R-016 reste **accepté** : un obfuscateur déterminé passera.

---

## D-016 — `overrides` Next : une seule version dans l'arbre, imposée

**Date** : 2026-08-05
**Contexte** : `@react-email/ui@6.9.1` (ajouté en D-015) dépend de `next@16.2.6`, sous le
seuil de correction 16.2.11 — 9 alertes dont 4 hautes, réintroduites par le paquet même
qui devait purger l'arbre. Relevé par le quatrième audit, qui a aussi prouvé la causalité
en retirant l'`overrides` : la version vulnérable revient.
**Décision** : `overrides: next: 16.2.12` dans `pnpm-workspace.yaml`. Découverte au
passage : le champ `overrides` de `package.json` est **ignoré par pnpm 10 en workspace**
— celui hérité du template (`parse5`) était donc inopérant ; le réglage doit vivre dans
`pnpm-workspace.yaml`.
**Conséquences** : toute dépendance transitive reçoit ce Next, quelle que soit sa
déclaration. À chaque montée de Next, mettre à jour **l'override et les déclarations**
ensemble. `apps/email` a été réparé dans la foulée : `packages/email` ne déclarait pas
`@react-email/render`, le rendu échouait — le build d'`apps/email` est devenu un
`email export` réel, branché dans `verify` et la CI, parce qu'un HTTP 200 du serveur de
prévisualisation ne prouve pas qu'un template se rend.

---

## D-015 — react-email 5 → 6, et exception nommée à la politique de confiance

**Date** : 2026-08-05
**Contexte** : 28 alertes de vulnérabilité visaient `next@16.1.6`, alors que les
applications tournent en 16.2.12. Je les ai d'abord prises pour des fantômes issus d'une
entrée orpheline du lockfile — **deux fois, à tort**. Une purge chirurgicale a été tentée :
`pnpm install --frozen-lockfile` l'a refusée aussitôt (`Broken lockfile`), ce qui a révélé
la vraie cause. Ma vérification cherchait la chaîne `next@16.1.6` ; les références internes
du lockfile s'écrivent `next: 16.1.6(…)`. Le coupable réel :
`@react-email/preview-server@5.2.9`, qui **dépend** de `next@16.1.6`.

**Décision** : monter `apps/email` en `react-email@6.9.1`, qui ne dépend plus de Next.
La v6 sort l'interface de prévisualisation dans `@react-email/ui`, qu'elle propose
d'installer **interactivement** au premier lancement — inacceptable dans un script ou en
CI : le paquet est donc déclaré explicitement. `@react-email/preview-server` est retiré.

Pourquoi cette option plutôt que les deux autres :

- *supprimer `apps/email`* contredirait le principe de la graine — quelles intégrations
  garder est la première décision du **projet dérivé**, pas celle du squelette ;
- *garder 5.2.9* ferait hériter à chaque copie 28 vulnérabilités réelles et un `next`
  périmé dans l'arbre, qui polluerait tous les tris d'alertes ultérieurs.

**Exception à la politique de confiance.** La montée était bloquée par
`trustPolicy: no-downgrade` sur `chokidar@4.0.3`. Ce contrôle a écarté quatre paquets en
une semaine (`@langchain/core`, `@arcjet/next`, `resend`, `chokidar`) : il est utile, mais
il refuse aussi des correctifs de sécurité. Un contrôle qui empêche d'appliquer un
correctif protège moins qu'il ne coûte. Plutôt que de le désarmer, `trustPolicyExclude`
reçoit une exception **nommée, datée et motivée** — même discipline qu'un `nosemgrep`.
Le signal sur chokidar est une perte d'attestation de provenance entre deux versions,
pas une preuve de compromission.

**Vérifié** : `next@16.1.6` a disparu du lockfile ; la prévisualisation démarre et répond
**HTTP 200** sur le port 3003 en React Email 6.9.1 ; `pnpm verify` complet au vert.

---

## D-014 — Arcjet retiré, Nosecone conservé

**Date** : 2026-08-05
**Contexte** : `packages/security` mélangeait deux briques du même éditeur —
**Nosecone** (en-têtes de sécurité, sans clé ni compte) et **Arcjet** (bot/WAF, sur clé).
Arcjet n'a jamais été actif : sans `ARCJET_KEY`, `secure()` retournait immédiatement.
Le propriétaire du produit a jugé que l'offre ne répondrait pas à son besoin.

Une hypothèse à corriger dans mon raisonnement : j'ai d'abord cru que retirer Arcjet
débloquerait `pnpm dedupe`, bloqué par `trustPolicy: no-downgrade` sur
`@arcjet/next@1.2.0`. **C'est faux** : une fois Arcjet retiré, `resend@6.18.1` bloque à
son tour, pour le même motif. `pnpm dedupe` est incompatible avec cette politique de
confiance sur cet arbre de dépendances, indépendamment d'Arcjet. Le retrait ne se
justifie donc que par ses mérites propres, pas par cet effet de bord espéré.

**Décision** : retirer `@arcjet/next` de `packages/security` et de `apps/web`, supprimer
`secure()` et ses deux appels (`apps/app/app/(authenticated)/layout.tsx`,
`apps/web/proxy.ts`), retirer `ARCJET_KEY` des schémas et des `.env.example`.
**Nosecone reste** : les en-têtes de sécurité ne coûtent rien et protègent réellement.

**Conséquence assumée** : plus aucune protection contre les bots ni pare-feu applicatif.
Toute route publique ou coûteuse doit se borner elle-même — taille, durée, fréquence,
limitation de débit. Consigné en R-003.

**Pour revenir en arrière** :

```bash
pnpm --filter @repo/security add @arcjet/next
```

puis restaurer `secure()` depuis l'historique (`git log -- packages/security/index.ts`),
et remettre `ARCJET_KEY` dans `packages/security/keys.ts` et les `.env.example`.

**Vérifié** : `pnpm verify` complet après retrait — lint 310 fichiers, typecheck
24 workspaces, tests, 50 cas du garde-fou, 10 cas des scripts, frontières, build app + api.

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
