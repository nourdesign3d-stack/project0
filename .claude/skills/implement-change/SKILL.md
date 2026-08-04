---
name: implement-change
description: Procédure d'analyse puis d'implémentation d'un changement limité dans ce monorepo. À utiliser dès qu'une modification de code non triviale est demandée (fonctionnalité, correction, refactor ciblé).
---

# Implémenter un changement

Procédure en 4 phases. **Ne pas écrire de code avant la fin de la phase 1.**

## Phase 1 — Cadrage (obligatoire, écrite)

Produire ce bloc avant toute modification :

```
BESOIN         : ...
CRITÈRES       : ... (vérifiables, pas « ça marche »)
PÉRIMÈTRE      : apps/packages touchés
CONTRATS       : routes, actions, exports de packages, schéma Prisma impactés
DONNÉES        : entités lues/écrites, tenant concerné, migration nécessaire ? (oui/non)
PERMISSIONS    : qui a le droit, vérifié où, côté serveur
RISQUES        : ce qui peut casser ailleurs
TESTS PRÉVUS   : succès + refus + cas limite
HYPOTHÈSES     : ce qui n'est pas confirmé
```

Étapes de collecte :

1. Lire les fichiers réellement concernés (pas seulement celui nommé dans la demande).
2. Chercher un précédent dans le dépôt : un motif identique existe probablement déjà —
   le suivre plutôt qu'en inventer un.
3. Pour un changement transversal : `pnpm graph` puis inspection du code réel.
4. Lire les règles applicables dans `.claude/rules/` (architecture, security, database).

Si une information manquante change la nature du travail → poser la question.
Sinon → consigner l'hypothèse et continuer.

## Phase 2 — Implémentation

- Le plus petit changement cohérent qui satisfait les critères. Rien de plus.
- Pas de renommage, reformatage, réorganisation ou « amélioration » hors périmètre.
- Suivre les conventions locales (nommage, structure de dossiers, style d'export).
- Pas de nouvelle dépendance sans demander : chercher d'abord dans les packages existants.
- Frontière serveur → authentifier, valider (Zod), autoriser, exécuter, répondre au minimum.
- Écriture multiple liée → transaction. Opération rejouable → idempotence.
- `"use client"` au niveau le plus bas possible.
- Schéma Prisma modifié → migration versionnée, jamais `db push`.

## Phase 3 — Vérification

Exécuter, dans cet ordre, en s'arrêtant au premier échec :

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build --filter=<app concernée>...
```

Selon le changement, ajouter : `pnpm semgrep`, `pnpm e2e`, `pnpm migrate:status`.
Voir `docs/QUALITY_GATES.md` pour la matrice complète.

Ne jamais rapporter un résultat non obtenu. Si une commande ne peut pas tourner
(secret manquant, service indisponible), le dire explicitement.

## Phase 4 — Restitution

```
FICHIERS MODIFIÉS : ...
COMMANDES         : ... (avec résultat réel)
NON VÉRIFIÉ       : ...
RISQUES RÉSIDUELS : ...
SUITE RECOMMANDÉE : une seule action
```

Mettre à jour la documentation impactée (`docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`,
`docs/DOMAIN_MODEL.md`, `docs/DATA_DICTIONARY.md`) dans le même changement.

Pour un changement à risque, enchaîner avec `/blind-spot-review`.
