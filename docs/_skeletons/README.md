# Squelettes de documentation

Versions **vierges** des documents propres à un projet. Elles ne décrivent aucun produit :
elles fixent la structure et les questions auxquelles il faut répondre.

`pnpm project:init --name <slug>` les copie par-dessus `docs/` pour repartir d'une page
blanche après avoir dupliqué le dépôt.

## Répartition

| Document | Nature |
| --- | --- |
| `PROJECT_CONTEXT.md` | **journal** — remis à zéro à chaque nouveau projet |
| `DOMAIN_MODEL.md` | **journal** |
| `DATA_DICTIONARY.md` | **journal** |
| `ASSUMPTIONS.md` | **journal** |
| `RISKS.md` | **journal** |
| `DECISIONS.md` | **journal** |
| `ARCHITECTURE.md` | *conservé* — décrit le squelette next-forge, vrai pour toute copie |
| `SECURITY_MODEL.md` | *conservé* — actifs et contrôles du squelette |
| `QUALITY_GATES.md` | *conservé* — matrice de contrôles, indépendante du produit |
| `DEPLOYMENT.md` | *conservé* — CI, variables, migrations du squelette |

Les quatre documents *conservés* restent valables tant que l'architecture ne bouge pas ;
il faut les relire, pas les vider. Les six documents *journal* racontent l'histoire d'un
produit donné : les garder d'un projet à l'autre reviendrait à mentir sur le nouveau.
