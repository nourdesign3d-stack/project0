---
description: Tests, typage, lint et définition de terminé.
globs: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**", "e2e/**", "**/vitest.config.*"]
---

# Règles de qualité

## Outillage réel

- **Lint / format** : Biome via Ultracite (`biome.jsonc`) → `pnpm lint`, `pnpm format`.
- **Typecheck** : `tsc --noEmit` par workspace, orchestré par Turborepo → `pnpm typecheck`.
  Référence actuelle : **0 erreur sur 24 workspaces**. Toute régression est un blocage.
- **Tests unitaires / intégration** : Vitest (`apps/app`, `apps/api`) → `pnpm test`.
- **Tests E2E** : Playwright à la racine (`playwright.config.ts`, `e2e/tests`) → `pnpm e2e`.
- **Sécurité statique** : Semgrep → `pnpm semgrep`.

## Quoi tester en priorité

1. règles métier et invariants ;
2. permissions et isolation inter-organisation (**tester les refus**) ;
3. migrations et compatibilité de schéma ;
4. opérations financières et idempotence ;
5. webhooks (signature, rejeu, payload malformé) ;
6. gestion d'erreur et cas limites ;
7. parcours critiques (E2E, quelques-uns seulement) ;
8. régressions : tout bug corrigé arrive avec un test qui échouait avant.

Un test qui ne peut pas échouer ne teste rien. Ne pas tester l'implémentation de Prisma
ou de Next.js ; tester le comportement du produit.

## Interdits

- Supprimer, commenter ou `skip` un test pour faire passer une chaîne.
- Neutraliser une règle de lint sans justification écrite à la ligne concernée.
- `any`, `as unknown as`, `@ts-ignore` pour contourner une erreur de type.
- `|| true` ou étape « informative » non déclarée dans la CI.

## Définition de terminé

Une tâche est terminée quand **toutes** ces conditions sont réunies :

- [ ] le besoin est satisfait et les critères d'acceptation sont vérifiés ;
- [ ] l'architecture et les contrats restent cohérents ;
- [ ] les règles métier sont préservées ;
- [ ] les permissions sont contrôlées côté serveur ;
- [ ] les données restent cohérentes, les migrations sont traitées ;
- [ ] les erreurs sont gérées et observables ;
- [ ] les tests nécessaires existent et passent ;
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` passent ;
- [ ] les contrôles de sécurité applicables passent ;
- [ ] le déploiement est maîtrisé et une récupération est possible ;
- [ ] la documentation concernée est à jour ;
- [ ] les éléments **non vérifiés** sont explicitement signalés.

Les contrôles exigés selon le type de changement sont détaillés dans
`docs/QUALITY_GATES.md`.
