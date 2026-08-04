---
name: release-readiness
description: Contrôle avant livraison — état Git, chaîne de qualité, migrations, variables, observabilité, rollback. Produit une décision READY / READY_WITH_KNOWN_RISKS / BLOCKED. Ne déploie jamais.
---

# Contrôle de pré-livraison

Cette procédure **vérifie**. Elle ne déploie pas, ne pousse pas, ne modifie pas la
production. Toute action de déploiement reste à la décision explicite d'un humain.

## 1. État Git

```bash
git status --short
git log --oneline -10
git diff main...HEAD --stat
```

Vérifier : pas de fichier non suivi involontaire, pas de `.env*` indexé, pas de secret
dans le diff, périmètre de la release compris et décrit.

## 2. Chaîne de qualité

Exécuter réellement, noter le résultat de chacune :

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build --filter=app... --filter=api...
```

Puis, selon le périmètre :

```bash
pnpm semgrep                 # tout changement touchant une frontière serveur
pnpm e2e                     # parcours critiques (nécessite une app démarrée)
pnpm build                   # build complet (nécessite BASEHUB_TOKEN)
```

Une commande non exécutable (secret ou service manquant) est reportée en
**NON VÉRIFIÉ**, jamais présentée comme réussie.

## 3. Migrations

```bash
pnpm migrate:status
```

- Migration versionnée présente et relue ?
- Compatible avec la version de code actuellement déployée (expand avant contract) ?
- Destructive ? → sauvegarde vérifiée + validation explicite du propriétaire.
- Ordre de déploiement décidé : migration avant code, ou code avant migration ?

## 4. Variables d'environnement

- Nouvelle variable ? Présente dans `.env.example`, documentée dans `docs/DEPLOYMENT.md`,
  configurée dans l'environnement cible ?
- Variable requise manquante → échec au démarrage attendu, pas dégradation silencieuse.
- Aucune valeur secrète versionnée.

## 5. Observabilité

- L'échec du nouveau comportement sera-t-il visible (Sentry, log) ?
- Existe-t-il un moyen de constater que la fonctionnalité marche en production ?
- Les logs ajoutés ne contiennent pas de donnée sensible.

## 6. Risques et récupération

- Risques connus listés (`docs/RISKS.md` à jour).
- Chemin de retour : rollback du déploiement **ou** roll-forward documenté.
- Fonctionnalité risquée derrière un feature flag, désactivable sans redéploiement ?
- Si aucun retour arrière n'existe : le déclarer avant livraison.

## 7. Décision

```
DÉCISION : READY | READY_WITH_KNOWN_RISKS | BLOCKED

Contrôles exécutés   : commande → résultat réel
Non vérifié          : ...
Risques acceptés     : ... (uniquement si READY_WITH_KNOWN_RISKS)
Motifs de blocage    : ... (uniquement si BLOCKED)
Ordre de déploiement : ...
Plan de retour       : ...
```

Règles de décision :

- **BLOCKED** dès qu'un contrôle obligatoire échoue, qu'une migration destructive n'est
  pas sauvegardée, qu'un secret est exposé, ou qu'aucun chemin de retour n'existe pour
  un changement irréversible.
- **READY_WITH_KNOWN_RISKS** si tous les contrôles obligatoires passent mais que des
  éléments restent non vérifiés — ils doivent être listés nommément et acceptés par un humain.
- **READY** seulement si tous les contrôles applicables ont été exécutés et sont au vert.
