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
