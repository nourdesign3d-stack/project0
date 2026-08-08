# Hypothèses

Toute hypothèse non confirmée par le propriétaire du produit ou par le code est consignée
ici. Une hypothèse n'est jamais présentée comme un fait.

| ID | Hypothèse | Origine | Impact si fausse | Validation attendue | Statut |
| --- | --- | --- | --- | --- | --- |
| H-001 | Le produit est un SaaS **multi-tenant** (organisations Clerk utilisées) | squelette next-forge | modèle de permissions et filtres de tenant à revoir entièrement | confirmation du propriétaire | **à valider** |
| H-002 | pnpm reste le gestionnaire de paquets | `pnpm-lock.yaml` du squelette | scripts, CI et documentation à réécrire | décision du propriétaire | **à valider** |
| H-003 | Le déploiement cible est Vercel | `vercel.json` par app, Sentry conditionné à `VERCEL`, flags Vercel | CI/CD, observabilité et flags à revoir | décision du propriétaire | **à valider** |
| H-004 | Postgres est la base retenue | `provider = "postgresql"` + `@prisma/adapter-pg` | schéma, adaptateur et compose à changer | décision du propriétaire | **à valider** |
| H-005 | Les intégrations livrées par le squelette seront toutes utilisées | squelette | packages inutilisés à supprimer pour réduire surface d'attaque et coût | arbitrage produit | **à valider** |

## Procédure

1. Hypothèse bloquante (avancer sans elle rendrait le travail inutile) → poser la question.
2. Hypothèse non bloquante → la consigner ici, choisir l'option la plus conservatrice, continuer.
3. Hypothèse validée → la retirer d'ici et l'inscrire dans le document concerné
   (`PROJECT_CONTEXT.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md`).
4. Hypothèse invalidée → créer une entrée dans `RISKS.md` si du code en dépend déjà.
