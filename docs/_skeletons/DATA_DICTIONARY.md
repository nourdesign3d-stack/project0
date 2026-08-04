# Dictionnaire de données

Document vivant : chaque donnée importante est décrite **avant** d'être persistée ou
envoyée à un tiers.

## Données persistées

| Donnée | Définition | Source de vérité | Sensibilité | Propriétaire | Conservation | Contraintes |
| --- | --- | --- | --- | --- | --- | --- |
| `Page.id` | Identifiant du stub de démonstration | Postgres | aucune | — | à supprimer | `@id @default(autoincrement())` |
| `Page.name` | Libellé du stub | Postgres | aucune | — | à supprimer | aucune |

## Données détenues par des tiers

| Donnée | Détenteur | Sensibilité | Remarque |
| --- | --- | --- | --- |
| Identité utilisateur (e-mail, nom, avatar) | Clerk | **personnelle** | ne pas dupliquer en base sans nécessité ni base légale |
| Appartenance organisation / rôle | Clerk | personnelle | source de vérité des permissions |
| Moyens de paiement, factures | Stripe | **financière** | ne jamais stocker de numéro de carte |
| Contenu éditorial du site public | BaseHub | publique | contenu non fiable côté rendu : échapper |
| Événements produit / analytics | PostHog, GA | pseudonymisée | ne pas y envoyer d'identifiant direct |
| Erreurs et traces | Sentry | **potentiellement sensible** | filtrer corps de requête, en-têtes, jetons |
| Journaux applicatifs | BetterStack (si configuré) | potentiellement sensible | ne pas journaliser de donnée personnelle inutile |

Retirer les lignes correspondant aux intégrations que le projet n'utilise pas.

## Règles générales

- **Minimisation** : ne persister que ce qui sert une règle métier écrite.
- **Source de vérité unique** : une donnée détenue par un tiers n'est pas recopiée « au
  cas où » ; si un cache est nécessaire, sa fraîcheur et son invalidation sont documentées ici.
- **Sensibilité** : `publique` / `interne` / `personnelle` / `financière` / `secret`.
  Toute donnée `personnelle`, `financière` ou `secret` implique : pas de log, pas d'URL,
  pas d'artefact CI, filtrage avant Sentry.
- **Conservation** : toute donnée personnelle a une durée de conservation et un moyen de
  suppression **avant** d'être introduite.
- **Contraintes** : préférer une contrainte de base à une vérification applicative
  (attention : `relationMode = "prisma"` désactive les clés étrangères — voir
  `.claude/rules/database.md`).
