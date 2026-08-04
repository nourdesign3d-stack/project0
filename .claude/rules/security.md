---
description: Authentification, autorisation, validation, webhooks, secrets, abus.
globs: ["apps/*/app/**", "packages/auth/**", "packages/security/**", "packages/rate-limit/**", "packages/webhooks/**", "packages/payments/**"]
---

# Règles de sécurité

## Principes

- **Refus par défaut**, moindre privilège, défense en profondeur.
- Toute entrée externe est hostile : `params`, `searchParams`, corps de requête,
  en-têtes, webhooks, fichiers, contenu CMS, réponses d'API tierces, sorties de modèles d'IA.
- Le typage n'est pas un contrôle de sécurité. La validation Zod l'est.

## Authentification et autorisation

- L'authentification est fournie par Clerk (`packages/auth`). Le proxy
  (`apps/app/proxy.ts`) n'est **pas** une couche d'autorisation : il ne fait que du
  routage/protection grossière.
- L'autorisation se vérifie **côté serveur, au plus près de l'accès aux données** :
  dans la server action ou le route handler, pas dans un composant client.
- Vérifier systématiquement l'appartenance de la ressource à l'utilisateur **et** à son
  organisation avant lecture ou écriture. Toute requête Prisma sur une donnée scopée doit
  inclure le filtre de tenant dans le `where`, jamais seulement en post-filtrage.
- Un identifiant fourni par le client ne prouve rien : re-résoudre l'entité côté serveur.

## Server Actions et route handlers

Squelette attendu :

1. authentifier (utilisateur + organisation) ;
2. valider les entrées avec un schéma Zod ;
3. autoriser l'opération sur la ressource ciblée ;
4. exécuter (transaction si plusieurs écritures liées) ;
5. renvoyer un résultat minimal, sans fuite de données internes ;
6. journaliser l'échec sans donnée sensible.

Tester les deux chemins : succès **et** refus (401/403/404 selon le cas).

## Webhooks

- Vérifier la signature avant tout traitement (Clerk, Stripe, Svix).
- Traiter le corps brut, pas un JSON re-sérialisé.
- Rendre le traitement **idempotent** : un même événement peut arriver plusieurs fois.
- Répondre rapidement ; déporter le travail long.
- Ne jamais faire confiance aux montants, statuts ou identifiants du payload sans les
  re-vérifier auprès du fournisseur pour les opérations financières.

## Secrets

- Aucun secret dans le dépôt, les logs, les messages d'erreur, les traces Sentry, les
  rapports Playwright ou les artefacts CI.
- `.env.example` documente les variables **sans valeur**. `.env.local` n'est jamais versionné.
- Ne jamais afficher le contenu d'un fichier d'environnement (interdit par
  `.claude/settings.json`).
- Les clés de services tiers sont scopées au minimum nécessaire (clé Stripe restreinte,
  jeton BaseHub en lecture seule, etc.) : le périmètre se restreint par la clé, pas
  seulement par le code.

## Abus et ressources

- `packages/security` (Arcjet + Nosecone) fournit protection de bot, WAF et en-têtes de
  sécurité ; `packages/rate-limit` fournit la limitation de débit.
- Protéger explicitement les routes coûteuses : IA, upload, export, recherche, envoi d'e-mail,
  endpoints publics non authentifiés.
- Borner taille de payload, durée d'exécution, nombre de tentatives et fréquence.

## Données personnelles

- Minimiser la collecte, ne pas journaliser d'identifiant personnel inutile.
- Filtrer les données sensibles avant envoi à Sentry ou à tout service d'analyse.
- Documenter toute donnée sensible dans `docs/DATA_DICTIONARY.md` et
  `docs/SECURITY_MODEL.md`.

## Outillage

`pnpm semgrep` complète — sans remplacer — la revue humaine, les tests et le lint.
Toute exclusion Semgrep est justifiée par un commentaire dans `.semgrepignore` ou la règle.
