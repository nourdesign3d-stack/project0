# AGENTS.md — Constitution commune

S'applique à tout agent ou outil automatisé intervenant sur ce dépôt (Claude Code,
assistants d'IDE, bots de revue, jobs CI). `CLAUDE.md` décrit la boucle de travail
quotidienne ; ce fichier fixe les principes non négociables.

## 1. Priorité absolue : sécurité et données

Une fonctionnalité visible ne justifie jamais une violation de règle métier, un
contournement de permission, une perte d'intégrité, une exposition de secret, une
migration dangereuse ou une modification non maîtrisée de la production.

En cas de conflit, l'ordre de priorité est :

```
sécurité et intégrité des données
> exactitude métier
> maintenabilité
> performance
> vitesse de livraison
```

## 2. Architecture modulaire

- Monolithe modulaire : `apps/*` consomment `packages/*`, jamais l'inverse.
- Une app n'importe jamais une autre app.
- Une capacité partagée vit dans un package dédié, avec un contrat explicite.
- Pas de dépendance circulaire. Pas de microservice sans besoin mesuré.
- Les règles métier ne vivent pas dans les composants d'interface.

## 3. Contrats explicites

- Toute frontière (route, server action, webhook, fonction exportée d'un package)
  a des entrées et sorties typées et validées.
- Validation runtime (Zod) à toutes les frontières externes : `params`, `searchParams`,
  corps de requête, webhooks, fichiers, réponses de services tiers, sorties de modèles d'IA.
- Un changement de contrat est un changement à annoncer, pas un effet de bord.

## 4. Règles métier protégées

- Les invariants métier sont documentés dans `docs/DOMAIN_MODEL.md` et
  `.claude/rules/project-domain.md`.
- Un invariant se protège en priorité par une contrainte de base de données, puis par une
  vérification serveur, puis par un test. Jamais uniquement par l'interface.

## 5. Autorisations côté serveur

- Refus par défaut, moindre privilège.
- L'autorisation est vérifiée côté serveur, dans la couche qui accède aux données —
  pas dans un composant client, pas uniquement dans le middleware.
- L'isolation entre organisations/utilisateurs est vérifiée à chaque requête de données.

## 6. Migrations versionnées

- Toute évolution de schéma passe par une migration Prisma versionnée et revue.
- `prisma db push` est réservé au prototypage local.
- Migrations progressives (expand → migrate → contract) pour rester compatible avec la
  version de code déjà déployée.
- Une suppression destructive n'est jamais silencieuse : elle est annoncée, justifiée,
  sauvegardée et réversible.

## 7. Tests selon le risque

Priorité de test : règles métier, permissions, isolation inter-organisation, migrations,
opérations financières, webhooks, idempotence, gestion d'erreur, parcours critiques,
régressions. **Tester les refus autant que les succès.**

## 8. Observabilité

Un changement significatif doit être observable : erreurs remontées (Sentry), journaux
utiles sans donnée sensible, et un moyen de constater le comportement en production.

## 9. Déployabilité

Après chaque changement, le dépôt reste compilable, testable, déployable, observable et
récupérable. Séparer autant que possible le déploiement du code et l'activation d'une
fonctionnalité risquée (feature flags).

## 10. Définition de terminé

Voir `docs/QUALITY_GATES.md`. Une tâche est terminée seulement si : besoin satisfait,
critères d'acceptation vérifiés, architecture cohérente, contrats respectés, règles métier
préservées, permissions contrôlées côté serveur, données cohérentes, erreurs gérées,
migrations traitées, tests nécessaires présents, `lint` + `typecheck` + `test` + `build`
au vert, contrôles de sécurité applicables passés, changement observable, déploiement
maîtrisé, récupération possible, documentation à jour, éléments non vérifiés signalés.

## 11. Transparence

Tout agent doit indiquer, à chaque livraison :

- les fichiers modifiés ;
- les commandes exécutées ;
- les résultats **réellement observés** ;
- ce qui n'a pas été vérifié ;
- les risques résiduels.

Interdiction formelle d'annoncer un succès non constaté, de maquiller un contrôle
(`|| true`, test désactivé, règle de lint neutralisée) ou de présenter une supposition
comme un fait.

## 12. Actions nécessitant une autorisation explicite

Installation de dépendance, écriture de migration, modification de la CI, accès réseau,
`git push`, ouverture de PR, Docker privilégié, déploiement, toute action touchant un
environnement partagé ou la production.
