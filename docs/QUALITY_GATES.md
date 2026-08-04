# Portes de qualité

Contrôles obligatoires **selon le type de changement**. Toute commande listée doit être
réellement exécutée ; un contrôle non exécuté est reporté en `NON VÉRIFIÉ`.

## Contrôles de base (tout changement de code)

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Référence à ne jamais dégrader : `pnpm typecheck` → **0 erreur sur 24 workspaces**.

## Matrice

| Type de changement | Contrôles obligatoires |
| --- | --- |
| **Changement visuel local** (composant, style) | `pnpm lint`, `pnpm typecheck`, test ciblé du workspace |
| **Composant du design system** | base + `pnpm --filter storybook exec tsc --noEmit` + revue d'usage des consommateurs |
| **Route, server action, handler** | base + validation Zod des entrées + autorisation serveur + tests **positifs et négatifs** + `pnpm semgrep` |
| **Webhook** | base + vérification de signature + test de rejeu (idempotence) + test de payload malformé |
| **Migration de schéma** | base + migration versionnée relue + `pnpm migrate:status` + compatibilité avec le code déployé + plan de récupération |
| **Opération financière (Stripe)** | base + idempotence + test de webhook + revue sécurité + `pnpm semgrep` |
| **Ajout de dépendance** | base + justification écrite + vérification licence/maintenance + `pnpm build --filter=<app>...` |
| **Changement de configuration TS/lint/CI** | base + `pnpm build --filter=app... --filter=api...` + relecture du diff de workflow |
| **Changement transversal / refactor** | base + `pnpm boundaries` + `pnpm graph` + `pnpm build` + `/blind-spot-review` |
| **Release** | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm semgrep`, `pnpm e2e` (parcours critiques) + `/release-readiness` |

## Contrôles conditionnés à un environnement

| Contrôle | Condition |
| --- | --- |
| `pnpm build` (complet) | `BASEHUB_TOKEN` disponible (build de `@repo/cms` requis par `apps/web`) |
| `pnpm e2e` | application démarrée + `E2E_BASE_URL` ; scénarios authentifiés ignorés sans identifiants de test |
| `pnpm semgrep` | Semgrep installé localement (`brew install semgrep` / `pipx install semgrep`) — toujours disponible en CI |

Ces conditions ne sont pas des exemptions : quand elles ne sont pas remplies, le contrôle
est déclaré **non exécuté**, jamais réussi.

## Règles de gate

- Un échec de `lint`, `typecheck`, `test` ou `build` **bloque**. Il ne se contourne pas
  (`|| true`, `skip`, `@ts-ignore`, désactivation de règle) : il se corrige.
- Un contrôle « informatif » doit être nommé comme tel et justifié dans
  `.claude/rules/deployment.md`. Aucun n'existe à ce jour.
- Toute nouvelle porte ajoutée à la CI est documentée ici dans le même changement.
