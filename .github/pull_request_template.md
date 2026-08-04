## Description

Besoin traité et critères d'acceptation vérifiés.

## Issues liées

Closes #<issue_number>

## Périmètre

- Applications / packages touchés :
- Contrats modifiés (routes, actions, exports de packages, schéma Prisma) :
- Migration incluse : oui / non

## Contrôles exécutés

Cocher uniquement ce qui a **réellement** été exécuté ; indiquer le reste en « non vérifié ».

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build --filter=<app>...`
- [ ] `pnpm semgrep` (si frontière serveur touchée)
- [ ] `pnpm e2e` (si parcours critique touché)
- [ ] `pnpm migrate:status` (si migration)

## Sécurité et données

- [ ] Entrées validées (Zod) aux frontières
- [ ] Autorisation vérifiée **côté serveur**, filtre de tenant présent
- [ ] Tests des cas de **refus** ajoutés
- [ ] Aucun secret ajouté (code, logs, artefacts, captures)
- [ ] Migration versionnée, progressive, avec chemin de récupération

## Exploitation

- [ ] Changement observable (erreur remontée, log utile, sans donnée sensible)
- [ ] Nouvelle variable d'environnement documentée dans `docs/DEPLOYMENT.md`
- [ ] Chemin de retour possible (rollback ou roll-forward), ou risque déclaré ci-dessous

## Non vérifié / risques résiduels

<!-- Obligatoire. Écrire « aucun » si c'est réellement le cas. -->

## Captures (si applicable)

<!-- Ne jamais inclure de donnée réelle ni de secret dans une capture. -->
