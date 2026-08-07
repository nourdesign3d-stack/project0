# Modèle de sécurité

État constaté au **2026-08-07**. Décrit ce qui existe, pas ce qui est souhaité.

⚠️ Ce document affirme des protections. Onze de ses affirmations étaient devenues
**fausses** au 2026-08-07, dont trois portaient sur des contrôles de sécurité (T-2002) :
un document de sécurité périmé est pire qu'absent, parce qu'on s'y fie. Trois d'entre
elles sont désormais vérifiées mécaniquement par
`apps/api/__tests__/documentation-claims.test.ts` ; les autres relèvent du jugement et
restent à la charge de la revue. Le dire vaut mieux que prétendre tout couvrir.

## Actifs à protéger

| Actif | Où | Impact si compromis |
| --- | --- | --- |
| Données des organisations | Postgres (Neon) | fuite inter-tenant, perte de confiance |
| Identités et sessions | Clerk | usurpation de compte |
| Moyens de paiement et facturation | Stripe | fraude financière |
| Secrets d'application | variables d'environnement | compromission totale |
| Intégrité du dépôt et de la chaîne de build | GitHub, GitHub Actions | injection de code en production |
| Confidentialité du code et de l'historique | **dépôt public depuis le 2026-08-07** | aucune : l'historique a été balayé avant bascule (88 commits, aucun secret). ⚠️ Toute donnée commitée à partir de maintenant est publique **immédiatement et définitivement** |
| Disponibilité des endpoints publics | `apps/web`, `apps/api` | abus, coût, déni de service |

## Acteurs

| Acteur | Confiance |
| --- | --- |
| Visiteur anonyme | nulle |
| Utilisateur authentifié | limitée à ses ressources et à son organisation |
| Membre d'une autre organisation | **traité comme un attaquant** vis-à-vis des données d'un tiers |
| Service tiers (webhooks entrants) | conditionnelle : uniquement après vérification de signature |
| Contributeur du dépôt | élevée, **auditée par la CI seule** — ⚠️ la revue n'est **pas** exigée : à un seul mainteneur, GitHub interdit d'approuver sa propre PR (D-048). 59 commits, un auteur. Ce document accordait une confiance « revue + CI » que rien ne soutenait, seize lignes au-dessus du passage qui l'établit. Voir R-028 |
| Agent automatisé (Claude Code, bots) | limitée : voir `.claude/settings.json` |

## Frontières de confiance

```
navigateur / client          → NON FIABLE
   ↓ (HTTP)
proxy Next (apps/*/proxy.ts) → routage, pas autorisation
   ↓
Server Components / Actions / Route handlers → point de contrôle
   ↓
packages serveur (auth, database, payments)  → accès privilégié
   ↓
Postgres / Stripe / Clerk / autres tiers
```

Tout ce qui traverse une flèche descendante doit être **validé** et **autorisé** au point
de contrôle. Les webhooks entrants court-circuitent l'authentification utilisateur : leur
seule protection est la vérification de signature.

## Contrôles existants

| Contrôle | Implémentation | Statut |
| --- | --- | --- |
| Authentification | Clerk (`packages/auth`) | **actif**, non configuré dans la graine (aucune clé versionnée) — mais **éprouvé à l'exécution** le 2026-08-05 sur un projet jetable à clés réelles : widget, session, vérification d'appareil, organisation, page authentifiée (D-018) |
| Protection de routes | aucune au niveau proxy, **par choix** : Clerk 7 déprécie la protection par correspondance de chemins, qui peut laisser des ressources joignables (D-019). L'autorisation vit **dans le fichier de chaque route** — un layout parent ne compte pas : un `route.ts` n'en exécute aucun, et Next évalue pages et layouts en parallèle. `apps/app/__tests__/route-protection.test.ts` échoue pour toute route dont le fichier ne porte pas son propre contrôle et qui n'est pas déclarée publique (D-033). Un audit externe avait démontré l'inverse le 2026-08-06 : un `route.ts` nu sous `(authenticated)` répondait `200` à un anonyme, test au vert | **couvert contre l'oubli, pas contre l'erreur** |
| En-têtes de sécurité | Nosecone (`packages/security`), appliqué par le proxy des **trois** apps | **actif, mesuré le 2026-08-06** (D-034) sur `apps/web` et `apps/api` — il ne l'était sur aucune des deux avant. ⚠️ **CSP désactivée** par configuration : R-025 |
| Bot / WAF | **aucun** — Arcjet retiré le 2026-08-05 (D-014) | **absent, assumé** |
| Limitation de débit | Upstash (`packages/rate-limit`) | câblé, clé absente |
| Validation des variables d'environnement | Zod + `@t3-oss/env-nextjs` | actif |
| Vérification de signature webhook | Clerk / Stripe / Svix dans `apps/api` | actif |
| Analyse statique de sécurité | Semgrep (`pnpm semgrep`, job CI) | actif |
| Mises à jour de dépendances | Dependabot (npm + actions) | actif |
| Restriction des actions de l'agent | `.claude/settings.json` (allow/ask/deny) + garde-fou Bash tokenisé (`.claude/hooks/`) | actif, **130 cas de test**. ⚠️ Cinq contournements successifs corrigés (D-036, D-040) ; le dernier désarmait les 26 règles dès que le dépôt vivait sous `/tmp` |
| Protection de `main` côté serveur | règle GitHub (D-048) | **active depuis le 2026-08-07** : `Lint · Typecheck · Test · Build` et `Semgrep` requis, poussée forcée et suppression interdites. ⚠️ Revue **non** exigée (un seul mainteneur ne peut approuver sa propre PR) et administrateurs non soumis — ce sont des confiances, pas des contrôles |

## Menaces principales

| Menace | Gravité | Contrôle actuel | Reste à faire |
| --- | --- | --- | --- |
| Accès inter-organisation | **critique** | aucun (pas encore de donnée métier) | filtre de tenant systématique + tests de refus dès la 1re entité |
| Autorisation absente sur une action serveur | **critique** | convention `.claude/rules/security.md` | revue systématique, tests négatifs |
| Rejeu de webhook / double traitement | élevée | signature vérifiée **et idempotence par contrainte de base** — ⚠️ éprouvée par test unitaire avec client simulé, **jamais avec deux livraisons concurrentes sur Postgres** : clé primaire composite `WebhookEvent(provider, eventId)` (D-023), réservation avant traitement, reprise atomique d'une réservation abandonnée après 15 min (D-049) | rien — le mécanisme est en place et éprouvé sous concurrence réelle |
| Fuite de secret (log, trace, artefact) | élevée | garde-fou Bash sur toute variante de `.env`, Semgrep `p/secrets`, filtre Sentry appliqué aux **deux** canaux et aux **trois** runtimes (D-026, D-035, D-045), artefacts Playwright coupés pour le parcours à identifiants (D-037) | ⚠️ les canaux **`log`** de Sentry et de BetterStack restent **non filtrés** (R-022) ; deux formes de secret dans une URL restent hors de portée du filtre — segment de chemin, mot sans schéma |
| Abus de route coûteuse (IA, upload, recherche) | élevée | **aucun** : plus de bot/WAF, rate-limit non configuré | borner taille, durée et fréquence dans le code ; activer la limitation de débit |
| Sortie de modèle d'IA ou réponse de tiers rendue telle quelle | moyenne | React échappe par défaut ; **plus aucun CMS** depuis le retrait de BaseHub (D-031), les pages légales sont écrites en dur | interdire `dangerouslySetInnerHTML` non assaini ; valider toute sortie de `@repo/ai` avant rendu ou appel de fonction |
| Dépendance compromise | moyenne | Dependabot, lockfile figé en CI | revue des mises à jour majeures |

## Risques non traités

- Plus aucune protection bot/WAF : Arcjet a été retiré. La limitation de débit reste
  inactive faute de clé. Toute route publique ou coûteuse doit se protéger elle-même.
- **La politique** de sauvegarde n'est pas définie : fréquence, rétention, emplacement,
  RPO/RTO. Le **mécanisme**, lui, a été répété de bout en bout le 2026-08-05 (D-027) —
  sauvegarde d'une base distante, restauration ailleurs, contenu et migrations contrôlés.
  Ce qui manque est une décision de propriétaire, pas un développement (R-004).
- La revue de ce qui part vers **Sentry** a été faite le 2026-08-05, au collecteur local
  (D-026) : les transactions emportaient en-tête d'autorisation, cookie, corps et jeton
  d'URL — corrigé et re-mesuré. **BetterStack** a été observé le même jour (D-028) : il ne recevait rien — les variables
  documentées n'étaient pas celles que la bibliothèque lit. Une fois corrigé, il expédie le
  message **et tous les champs structurés en clair**. Reste non filtré : le canal `log` de
  Sentry et celui de BetterStack (R-022).
- Aucun test de sécurité automatisé au-delà de Semgrep (pas de DAST, pas de fuzzing).

Suivi : [RISKS.md](./RISKS.md).
