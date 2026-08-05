# Modèle de sécurité

État constaté au 2026-08-04. Décrit ce qui existe, pas ce qui est souhaité.

## Actifs à protéger

| Actif | Où | Impact si compromis |
| --- | --- | --- |
| Données des organisations | Postgres (Neon) | fuite inter-tenant, perte de confiance |
| Identités et sessions | Clerk | usurpation de compte |
| Moyens de paiement et facturation | Stripe | fraude financière |
| Secrets d'application | variables d'environnement | compromission totale |
| Intégrité du dépôt et de la chaîne de build | GitHub, GitHub Actions | injection de code en production |
| Disponibilité des endpoints publics | `apps/web`, `apps/api` | abus, coût, déni de service |

## Acteurs

| Acteur | Confiance |
| --- | --- |
| Visiteur anonyme | nulle |
| Utilisateur authentifié | limitée à ses ressources et à son organisation |
| Membre d'une autre organisation | **traité comme un attaquant** vis-à-vis des données d'un tiers |
| Service tiers (webhooks entrants) | conditionnelle : uniquement après vérification de signature |
| Contributeur du dépôt | élevée mais auditée (revue + CI) |
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
| Authentification | Clerk (`packages/auth`) | actif, non configuré (clés absentes) |
| Protection de routes | aucune au niveau proxy — `apps/app/proxy.ts` n'appelle pas `auth.protect()` ; seule la redirection du layout authentifié protège les pages | **à traiter** |
| En-têtes de sécurité | Nosecone (`packages/security`) | actif |
| Bot / WAF | Arcjet (`packages/security`) | câblé, clé absente |
| Limitation de débit | Upstash (`packages/rate-limit`) | câblé, clé absente |
| Validation des variables d'environnement | Zod + `@t3-oss/env-nextjs` | actif |
| Vérification de signature webhook | Clerk / Stripe / Svix dans `apps/api` | actif |
| Analyse statique de sécurité | Semgrep (`pnpm semgrep`, job CI) | actif |
| Mises à jour de dépendances | Dependabot (npm + actions) | actif |
| Restriction des actions de l'agent | `.claude/settings.json` (allow/ask/deny) | actif |

## Menaces principales

| Menace | Gravité | Contrôle actuel | Reste à faire |
| --- | --- | --- | --- |
| Accès inter-organisation | **critique** | aucun (pas encore de donnée métier) | filtre de tenant systématique + tests de refus dès la 1re entité |
| Autorisation absente sur une action serveur | **critique** | convention `.claude/rules/security.md` | revue systématique, tests négatifs |
| Rejeu de webhook / double traitement | élevée | signature vérifiée | idempotence à implémenter par cas d'usage |
| Fuite de secret (log, trace, artefact) | élevée | deny Read sur `.env*`, Semgrep `p/secrets` | filtrage explicite avant Sentry |
| Abus de route coûteuse (IA, upload, recherche) | élevée | Arcjet + rate-limit non configurés | activer les clés, borner taille/durée/fréquence |
| Contenu CMS non fiable rendu tel quel | moyenne | React échappe par défaut | interdire `dangerouslySetInnerHTML` non assaini |
| Dépendance compromise | moyenne | Dependabot, lockfile figé en CI | revue des mises à jour majeures |

## Risques non traités

- Aucune clé de service n'est provisionnée : les protections Arcjet et rate-limit sont
  **inactives en pratique**.
- Aucune politique de sauvegarde/restauration de la base n'est définie ni testée.
- Aucune revue de journalisation n'a été faite (quels champs partent vers Sentry/BetterStack).
- Aucun test de sécurité automatisé au-delà de Semgrep (pas de DAST, pas de fuzzing).

Suivi : [RISKS.md](./RISKS.md).
