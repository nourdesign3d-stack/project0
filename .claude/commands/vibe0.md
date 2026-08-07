---
description: Démarrer un produit à partir de la graine — vérifier l'amorçage, puis définir le modèle de domaine avant d'écrire du code.
argument-hint: "[description du produit en une ou deux phrases]"
allowed-tools: Bash(pnpm install), Bash(pnpm verify), Bash(pnpm typecheck), Bash(pnpm test), Bash(pnpm migrate:status), Bash(pnpm boundaries), Bash(git status:*), Bash(git log:*), Bash(git remote -v), Read, Grep, Glob, Edit, Write
---

# /vibe0 — Démarrer un produit

Produit décrit par l'utilisateur : **$ARGUMENTS**

Cette commande couvre ce que `vibe0` (le script) ne fait **pas**, et qu'il annonce
lui-même : décider du périmètre, choisir les intégrations à retirer, écrire le modèle de
domaine.

⚠️ **Tu ne lances jamais le script `vibe0` toi-même.** Il saisit des clés de service en
mode masqué et les écrit dans les `.env.local` ; un assistant n'a pas à manipuler ces
valeurs. Si l'amorçage n'a pas eu lieu, tu le **signales** et tu t'arrêtes.

---

## A. Constater l'état — avant toute proposition

```bash
git remote -v
git log --oneline -3
pnpm verify
```

Puis lire, dans cet ordre : `README.md`, `CLAUDE.md`, `docs/SETUP.md`,
`.claude/rules/project-domain.md`, `docs/DOMAIN_MODEL.md`.

**Trois refus, à prononcer plutôt qu'à contourner :**

1. **Ce dépôt est-il encore la graine ?** Si `package.json` porte le nom d'origine, si
   `docs/DECISIONS.md` contient encore les décisions de la graine, ou si le distant pointe
   vers le dépôt de la graine → **arrêter**. Travailler dans la graine au lieu d'un clone
   est l'erreur la plus coûteuse de ce démarrage. Indiquer : `pnpm project:init` ou `vibe0`.
2. **`pnpm verify` passe-t-il ?** Sinon → rapporter la sortie réelle et s'arrêter. Un
   projet qui ne vérifie pas ne se développe pas.
3. **Le produit est-il décrit ?** Si `$ARGUMENTS` est vide et que `docs/PROJECT_CONTEXT.md`
   est un squelette → poser la question, ne rien inventer.

## B. Définir le domaine — la seule vraie difficulté

`.claude/rules/project-domain.md` **interdit d'inventer une règle métier**. Ton rôle est
d'obtenir les réponses, pas de les produire.

Poser, en une fois et en langage clair — jamais plus de questions que nécessaire :

| Question | Pourquoi elle bloque tout le reste |
| --- | --- |
| Quels **acteurs**, et que peut faire chacun ? | sans eux, aucune règle d'autorisation n'est écrivable |
| Quelles **entités**, et laquelle appartient à une organisation ? | détermine où le filtre de locataire est obligatoire |
| Quels **états** et quelles **transitions interdites** ? | une transition oubliée devient un bogue de données |
| Qu'est-ce qui doit rester vrai **quoi qu'il arrive** ? | ce sont les invariants ; ils se testent |
| Quelles actions sont **irréversibles** ? | elles exigent confirmation, idempotence, journal |

Toute réponse manquante devient une **hypothèse** consignée dans `docs/ASSUMPTIONS.md`
avec son impact si elle est fausse, et le comportement le plus conservateur est retenu —
refus par défaut, aucun effet de bord irréversible.

**Écrire `docs/DOMAIN_MODEL.md` et `.claude/rules/project-domain.md` avant toute ligne de
code.** C'est la seule étape qu'on ne peut pas rattraper après coup.

## C. Réduire la surface avant de l'augmenter

La graine câble une douzaine de services. R-009 est ouvert précisément pour cela : une
dépendance non utilisée est une surface d'attaque, une alerte de sécurité et une entrée
dans les pages légales.

Proposer un **retrait** service par service — jamais une suppression en bloc — en
distinguant ce que le produit décrit exige de ce dont il pourrait se passer. La décision
appartient à l'utilisateur ; consigner chaque retrait dans `docs/DECISIONS.md`.

## D. La première entité

Elle fixe les habitudes de toutes les suivantes. Exigences, dans l'ordre :

1. **le filtre de locataire dans le `where`**, jamais en post-filtrage — la règle Semgrep
   `local-tenant-filter-required` le refuse, et `pnpm semgrep` doit le prouver ;
2. **le contrôle d'autorisation dans le fichier de la route**, pas dans un layout parent —
   `apps/app/__tests__/route-protection.test.ts` échoue sinon ;
3. **des tests de refus**, pas seulement de succès : un membre d'une autre organisation
   doit être traité comme un attaquant ;
4. **une migration versionnée**, relue, et jamais modifiée après application ;
5. **la donnée inscrite dans `docs/DATA_DICTIONARY.md`** — un test l'exige.

## E. Rendre compte

Terminer par : ce qui a été **décidé**, ce qui reste **hypothèse**, ce qui n'a **pas** été
vérifié, et les commandes réellement exécutées avec leur sortie.

Ne jamais déclarer une étape terminée sans preuve d'exécution.
