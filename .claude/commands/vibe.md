---
description: Audit du respect des principes du projet (qualité, sécurité, données, déployabilité) et de la discipline de l'agent.
argument-hint: "[périmètre optionnel : chemin, 'diff', 'full']"
allowed-tools: Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test), Bash(pnpm build:*), Bash(pnpm semgrep), Bash(pnpm boundaries), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Grep, Glob
---

# /vibe — Contrôle de conformité du projet

Périmètre demandé : **$ARGUMENTS** (vide = dépôt entier ; `diff` = travail en cours).

Objectif : vérifier que le projet respecte **toujours** les principes fixés dans
`AGENTS.md`, `CLAUDE.md` et `.claude/rules/`. Cet audit **constate**, il ne corrige pas
sans demande explicite.

## A. Santé technique — exécuter et rapporter les résultats réels

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build --filter=app... --filter=api...
pnpm boundaries
```

Optionnel selon le périmètre : `pnpm semgrep`, `pnpm e2e`.
Une commande non exécutée ou non exécutable → **NON VÉRIFIÉ** (jamais « OK »).

## B. Invariants du dépôt — vérifier par lecture

1. **Secrets** — aucun `.env`/`.env.local` suivi par Git ; aucune valeur secrète dans le
   diff, les workflows, les tests ou la documentation.
   `git status --short`, `git diff`, recherche de motifs `sk_`, `pk_live`, `whsec_`, `AKIA`.
2. **Contrôles non maquillés** — aucun `|| true`, `continue-on-error` non justifié,
   `@ts-ignore`, `as unknown as`, `describe.skip`, `it.skip`, `test.skip` ajouté récemment,
   ni règle Biome désactivée sans commentaire.
3. **Frontières** — aucune app important une autre app ; aucun package important une app.
4. **Sécurité serveur** — les routes/actions ajoutées valident (Zod), authentifient et
   autorisent côté serveur ; les requêtes sur données scopées portent un filtre de tenant.
5. **Données** — toute évolution de schéma Prisma a une migration versionnée ;
   aucun `db push` ; contraintes et index déclarés.
6. **Typage** — `pnpm typecheck` reste à **0 erreur** ; aucune option `strict` affaiblie.
7. **Tests** — les changements récents ont des tests, incluant les cas de **refus**.
8. **Documentation** — `docs/` reflète le dépôt réel : commandes existantes, variables à
   jour, décisions consignées, hypothèses et risques datés.
9. **Dépendances** — aucun ajout non justifié ; pas de doublon fonctionnel ;
   Dependabot toujours actif sur les écosystèmes présents.
10. **Déployabilité** — le dépôt reste compilable et déployable ; les variables requises
    sont documentées ; un chemin de retour existe.
11. **Exceptions arrivées à échéance** — toute exception datée est-elle encore justifiée ?
    Chercher `ÉCHÉANCE` dans `pnpm-workspace.yaml`, `nosemgrep` dans le code, les
    `biome-ignore`, et les risques `accepté` de `docs/RISKS.md`. Une exception qu'on ne
    réexamine jamais devient une règle silencieuse.

## C. Discipline de l'agent — relire les derniers échanges

- Des résultats ont-ils été annoncés sans avoir été exécutés ?
- Une tâche a-t-elle été déclarée terminée sans preuve ?
- Des hypothèses ont-elles été présentées comme des faits ?
- Une action dangereuse a-t-elle été menée sans autorisation ?
- Des éléments non vérifiés ont-ils été signalés honnêtement ?

## Rendu attendu

```
VIBE CHECK — <date> — périmètre : <...>

CONTRÔLES EXÉCUTÉS
  commande → résultat réel

CONFORME
  - ...

DÉRIVES
  BLOQUANT     : ...
  IMPORTANT    : ...
  MINEUR       : ...

NON VÉRIFIÉ
  - ...

PROCHAINE ÉTAPE (une seule)
  - ...
```

Ne rien corriger sans demande. Si aucune dérive n'est trouvée, le dire clairement plutôt
que de fabriquer des remarques.
