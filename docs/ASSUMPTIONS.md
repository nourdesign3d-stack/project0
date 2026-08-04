# Hypothèses

Toute hypothèse non confirmée par le propriétaire du produit ou par le code est consignée
ici. Une hypothèse n'est jamais présentée comme un fait.

| ID | Hypothèse | Origine | Impact si fausse | Validation attendue | Statut |
| --- | --- | --- | --- | --- | --- |
| H-001 | Le produit est un SaaS **multi-tenant** (organisations Clerk utilisées) | template next-forge + activation des organisations Clerk | modèle de permissions et filtres de tenant à revoir entièrement | confirmation du propriétaire | **à valider** |
| H-002 | Le nom de projet `project0` est provisoire | choix d'initialisation (dossier `Project0`) | renommage du package racine et des métadonnées | décision du propriétaire | **à valider** |
| H-003 | pnpm est le gestionnaire de paquets définitif | `pnpm-lock.yaml` généré à l'initialisation | scripts, CI et documentation à réécrire | décision du propriétaire | **à valider** |
| H-004 | Le déploiement cible est Vercel | `vercel.json` par app, Sentry conditionné à `VERCEL`, flags Vercel | CI/CD, observabilité et flags à revoir | décision du propriétaire | **à valider** |
| H-005 | Postgres (Neon en production, Docker en local) est la base retenue | `provider = "postgresql"` + `@prisma/adapter-neon` | schéma, adaptateur et compose à changer | décision du propriétaire | **à valider** |
| H-006 | Les intégrations livrées par le template (Stripe, Knock, Liveblocks, BaseHub, Resend…) seront toutes utilisées | template | packages inutilisés à supprimer pour réduire la surface d'attaque et le coût | arbitrage produit | **à valider** |
| H-007 | Les corrections de dérive de versions appliquées au template préservent le comportement d'origine | inspection des types des SDK installés | comportement runtime différent de l'intention initiale (voir DECISIONS.md D-002 à D-005) | test manuel une fois les clés de service disponibles | **non vérifié** |

## Procédure

1. Une hypothèse bloquante (proceder sans elle rendrait le travail inutile) → poser la question.
2. Une hypothèse non bloquante → la consigner ici, choisir l'option la plus conservatrice, continuer.
3. Une hypothèse validée → la retirer de ce tableau et l'inscrire dans le document concerné
   (`PROJECT_CONTEXT.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md`).
4. Une hypothèse invalidée → créer une entrée dans `RISKS.md` si du code en dépend déjà.
