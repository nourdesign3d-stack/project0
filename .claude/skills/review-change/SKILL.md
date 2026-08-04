---
name: review-change
description: Revue indépendante d'un diff (travail local, branche ou PR) dans ce monorepo. À utiliser avant de committer, avant d'ouvrir une PR, ou pour relire un changement déjà écrit.
---

# Revue de changement

Revue **indépendante** : relire le diff comme si un tiers l'avait écrit. Ne pas
justifier les choix déjà faits, les vérifier.

## 1. Établir le périmètre

```bash
git status --short
git diff            # travail non indexé
git diff --staged   # travail indexé
git diff main...HEAD --stat   # branche complète
```

Lister : fichiers modifiés, workspaces concernés, contrats touchés (routes, actions,
exports de packages, schéma Prisma), migrations, dépendances, CI.

## 2. Lire le code environnant

Un diff se juge dans son contexte : ouvrir les fichiers appelants et appelés, pas
seulement les lignes changées. Vérifier qu'un motif existant n'a pas été dupliqué ou
contredit.

## 3. Grille de revue

**Exactitude**
- Le changement fait-il ce que la demande exigeait, et rien d'autre ?
- Cas limites : liste vide, valeur nulle, doublon, concurrence, second appel.
- Erreurs gérées ou propagées volontairement — jamais avalées silencieusement.

**Sécurité** (`.claude/rules/security.md`)
- Entrées validées par Zod à la frontière ?
- Autorisation vérifiée côté serveur, au plus près des données ?
- Filtre de tenant présent dans **chaque** requête sur une donnée scopée ?
- Aucun secret, aucune donnée sensible en log, en réponse ou en trace ?

**Données** (`.claude/rules/database.md`)
- Migration versionnée, progressive, réversible ?
- Contraintes/index déclarés plutôt que vérifiés en code ?
- Écritures liées en transaction ? Opération rejouable idempotente ?
- Aucune suppression destructive silencieuse ?

**Architecture** (`.claude/rules/architecture.md`)
- Frontières respectées (pas d'app → app, pas de package → app) ?
- Règle métier placée dans la couche serveur, pas dans un composant d'UI ?
- `"use client"` au bon niveau ? Données envoyées au client minimisées ?
- Dépendance ajoutée : justifiée, maintenue, sans doublon fonctionnel ?

**Qualité** (`.claude/rules/quality.md`)
- Tests présents pour le succès **et** le refus ? Un test qui aurait échoué avant ?
- Aucun `any`, `@ts-ignore`, test `skip`, règle de lint neutralisée sans justification ?
- Documentation impactée mise à jour ?

**Exploitation** (`.claude/rules/deployment.md`)
- Le changement est-il observable ? Déployable sans coordination cachée ?
- Nouvelle variable d'environnement documentée dans `docs/DEPLOYMENT.md` ?

## 4. Vérifier par exécution

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Ne pas conclure « ça passe » sans avoir lancé les commandes.

## 5. Rendu

Classer chaque constat :

```
BLOQUANT     — ne doit pas être livré en l'état (motif + correctif proposé)
IMPORTANT    — à traiter avant livraison ou avec un ticket explicite
AMÉLIORATION — souhaitable, non bloquant
NON VÉRIFIÉ  — ce que la revue n'a pas pu établir
```

Aucun constat ne doit rester vague : fichier, ligne, scénario d'échec concret.
S'il n'y a rien de bloquant, le dire clairement plutôt que d'inventer des remarques.
