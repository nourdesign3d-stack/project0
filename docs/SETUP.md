# Démarrer un projet depuis la graine

Ce document répond à trois questions, dans l'ordre où elles se posent :

1. **que faut-il pour que ça démarre ?** (réponse : très peu)
2. **quelle clé, chez qui, et partagée ou non entre projets ?**
3. **qu'est-ce qui doit changer avant un déploiement ?**

Il est **vérifié automatiquement** : `apps/api/__tests__/setup-guide.test.ts` échoue si une
variable déclarée dans un `.env.example` n'apparaît pas ici. Un guide de configuration qui
oublie une variable est pire qu'absent — on croit avoir tout renseigné.

---

## 1. Le minimum pour démarrer

**Aucun compte tiers n'est nécessaire.** Trois commandes, et l'application tourne :

```bash
pnpm install
pnpm env:setup                              # crée les .env.local des 6 workspaces
pnpm --filter @repo/database run build      # génère le client Prisma
docker compose up -d                        # Postgres local
pnpm migrate                                # applique les migrations
pnpm dev
```

`env:setup` renseigne `DATABASE_URL` vers le Postgres du conteneur et **commente toutes les
variables optionnelles** — une variable optionnelle laissée à `""` échoue la validation
Zod, c'est le piège le plus fréquent.

**Seules trois variables sont réellement requises** : `DATABASE_URL`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEB_URL`. Tout le reste est optionnel : le service
correspondant est simplement inactif.

⚠️ Sans clé Clerk, l'application démarre mais les pages d'authentification ne s'affichent
pas. C'est le premier service à brancher si vous voulez voir un parcours complet.

---

## 2. Les services : lequel, quand, et à quelle échelle

### La règle : un compte par produit

**Chaque produit dérivé de la graine a ses propres comptes**, pas seulement ses propres
clés. La raison n'est pas l'hygiène, c'est le **rayon d'explosion** : une clé qui fuite ne
doit compromettre qu'un produit, et une clé partagée entre deux produits ne peut jamais
être révoquée sans en casser un.

| Service | Unité à créer par produit | Environnements |
| --- | --- | --- |
| Clerk | une **application** | instance de développement **et** de production, clés distinctes |
| Neon | un **projet** | des **branches** dans le même projet |
| Stripe | un **compte** — exigence comptable autant que technique | mode test **et** mode réel |
| PostHog | un **projet** | un projet par environnement si le bruit gêne |
| Sentry | un **projet par application** (`app`, `web`, `api`) | un DSN par projet |
| BetterStack | une **source** de journaux + un **moniteur** | par environnement |
| Resend | un **domaine** vérifié + une clé | la clé peut être restreinte par domaine |
| Knock, Liveblocks, Svix, Upstash | un **projet** chacun | selon besoin |

### Par ordre d'urgence

| Ordre | Service | Nécessaire quand | Variables |
| --- | --- | --- | --- |
| 1 | **Base de données** | tout de suite (le conteneur suffit) | `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_PORT` |
| 2 | **Clerk** | dès que vous voulez une authentification | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| 3 | **Sentry** | dès qu'un autre que vous utilise le produit | DSN, voir `packages/observability` |
| 4 | **Resend** | dès qu'un e-mail part | `RESEND_TOKEN`, `RESEND_FROM` |
| 5 | **Stripe** | à la première facturation | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| 6 | **PostHog** | quand vous avez une **question** à poser | `POSTHOG_REGION`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| 7 | **BetterStack** | à la mise en service | `BETTER_STACK_SOURCE_TOKEN`, `BETTER_STACK_INGESTING_URL`, `BETTERSTACK_API_KEY`, `BETTERSTACK_URL` |
| — | Knock, Liveblocks, Svix, Upstash, GA | seulement si la fonctionnalité est utilisée | `KNOCK_SECRET_API_KEY`, `NEXT_PUBLIC_KNOCK_API_KEY`, `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`, `LIVEBLOCKS_SECRET`, `SVIX_TOKEN`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` |

**PostHog n'est pas urgent, et c'est un choix.** De l'analytique que personne ne lit est une
collecte sans finalité — et une finalité est précisément ce qu'exige un règlement sur les
données personnelles. Le brancher le jour où vous avez une question à lui poser.

### Ce que vous générez vous-même

Ces valeurs ne viennent d'aucun fournisseur : vous les fabriquez, **une par projet et par
environnement**.

| Variable | Rôle | Comment |
| --- | --- | --- |
| `FLAGS_SECRET` | protège la découverte des feature flags | `openssl rand -base64 32` |
| `CRON_SECRET` | seule protection des tâches planifiées, publiquement joignables | `openssl rand -base64 32` |
| `MANIFEST_TOKEN` | protège `/manifest`, qui dit **quels services sont branchés** dans cet environnement | `openssl rand -base64 32` |

Sans `CRON_SECRET`, `/cron/keep-alive` et `/cron/purge-webhook-events` répondent `503` —
refus par défaut, pas de dégradation silencieuse.

### Les URL

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | application authentifiée (3000 en local) |
| `NEXT_PUBLIC_WEB_URL` | site public (3001) |
| `NEXT_PUBLIC_API_URL` | webhooks et cron (3002) |
| `NEXT_PUBLIC_DOCS_URL` | documentation produit (3004) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` · `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | chemins des pages Clerk |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` · `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | redirection après authentification |
| `VERCEL_PROJECT_PRODUCTION_URL` | posée par Vercel ; sert les métadonnées SEO |
| `LANGUINE_PROJECT_ID` | traduction des contenus, si utilisée |

⚠️ `NEXT_PUBLIC_POSTHOG_HOST` doit pointer sur **votre** domaine suivi de `/ingest`, pas sur
`*.i.posthog.com`. Le proxy existe parce qu'un appel direct est bloqué par la plupart des
bloqueurs de publicité — la mesure devient alors partielle sans que rien ne le signale.

### Le manifeste — ce que le dépôt expose à un plan de pilotage

```bash
pnpm manifest         # régénère manifest.json
pnpm manifest:check   # échoue s'il n'est plus à jour (dans pnpm verify)
```

`manifest.json` décrit la **composition** : chaque capacité, son fournisseur, sa
criticité, ses versions, les variables qu'elle exige, et **qui l'importe réellement**.

Il est **calculé, jamais rédigé**. Ce qui ne se devine pas — identité et fournisseur —
est déclaré dans le `package.json` de chaque package, sous la clé `capability`. Tout le
reste est dérivé, **y compris le statut** : un package que personne n'importe est marqué
`unused`, quoi qu'en dise son auteur. Seul `building` est déclarable, parce qu'une
intention ne se devine pas.

⚠️ Le manifeste ne dit **pas** si une capacité est branchée : cela dépend de
l'environnement, pas du dépôt. C'est la route `/manifest` de `apps/api` qui le dit, pour
l'environnement où elle tourne, et elle ne renvoie **que des booléens de présence** —
jamais une valeur. Sans `MANIFEST_TOKEN`, elle répond `503`.

---

## 3. Avant un déploiement

Rien de ce qui suit n'est optionnel, et rien n'est détecté automatiquement.

### Les clés

- [ ] **Clerk : passer de l'instance de développement à celle de production.** Les clés
      `pk_test_`/`sk_test_` ne doivent jamais servir en production — instance distincte,
      utilisateurs distincts, domaine à vérifier chez le fournisseur.
- [ ] **Stripe : passer en mode réel**, et préférer une **clé restreinte** au secret
      complet. Le périmètre se restreint par la clé, pas seulement par le code.
- [ ] **Enregistrer les points de terminaison webhook** avec les URL réelles, et reporter
      leurs secrets de signature (`CLERK_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`). Un
      secret mal formé provoque un `400`, pas une boucle de réessais (D-046) — mais aucun
      événement n'est traité.
- [ ] **Générer `CRON_SECRET` et `FLAGS_SECRET`** pour l'environnement de production.
- [ ] **`DATABASE_URL` : prendre le point d'accès « pooler »** (D-025). Sans lui, la limite
      de connexions du plan est atteinte bien avant la charge réelle, et l'erreur survient
      sous trafic, jamais en test.
- [ ] **Remplacer toutes les `NEXT_PUBLIC_*_URL`** par les domaines réels.

### Ce qui n'est pas une clé

- [ ] **Rédiger et faire relire les pages légales** (R-024). Le bandeau d'avertissement
      disparaît quand elles sont relues, pas avant.
- [ ] **Écrire la CSP** (R-025). Elle est désactivée par défaut, et ne peut pas être
      générique : elle se rédige à partir des origines réellement utilisées.
- [ ] **Appliquer la politique de sauvegarde** (`RECOVERY.md`) : emplacement hors
      hébergeur, automatisation, et surtout **moniteur de pulsation** — sans lui, une
      interruption prolongée de la sauvegarde reste invisible.
- [ ] **Vérifier la protection de `main`** — active depuis le 2026-08-07, mais la revue
      n'est pas exigée tant qu'il n'y a qu'un mainteneur (D-048).
- [ ] **Borner les routes publiques coûteuses** (R-003). Il n'y a ni pare-feu applicatif ni
      limitation de débit : chaque route exposée doit se protéger elle-même.
- [ ] **Lancer `pnpm e2e` avec des identifiants de test.** `pnpm verify` **n'exécute pas
      Playwright** : c'est la seule couverture du parcours authentifié.

### Ce qui ne doit jamais partir en production

- une clé de développement, quelle qu'elle soit ;
- un `.env.local` versionné — ils ne le sont jamais, et le garde-fou Bash refuse de les
  lire ;
- un exécuteur GitHub Actions **auto-hébergé** sur ce dépôt : il est public, ce serait
  offrir l'exécution de code à n'importe qui.

---

## Voir aussi

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — CI, environnements, observabilité
- [`RECOVERY.md`](./RECOVERY.md) — sauvegarde et restauration
- [`SECURITY_MODEL.md`](./SECURITY_MODEL.md) — ce qui est protégé, et ce qui ne l'est pas
- [`RISKS.md`](./RISKS.md) — chaque risque avec son propriétaire et son déclencheur
