# Dictionnaire de données

Document vivant : chaque donnée importante est décrite **avant** d'être persistée ou
envoyée à un tiers.

## Données persistées

| Donnée | Définition | Source de vérité | Sensibilité | Propriétaire | Conservation | Contraintes |
| --- | --- | --- | --- | --- | --- | --- |
| `WebhookEvent.provider` | Fournisseur émetteur (`clerk`, `stripe`) | Postgres | aucune | — | 30 jours après achèvement | partie de la clé primaire composite |
| `WebhookEvent.eventId` | Identifiant de **livraison** du fournisseur | le fournisseur | interne | — | 30 jours après achèvement | partie de la clé primaire composite — c'est **elle** qui garantit l'idempotence |
| `WebhookEvent.receivedAt` | Instant de la réservation, remis à jour lors d'une reprise | Postgres | aucune | — | 30 jours après achèvement | indexé : sert la purge **et** la reprise des réservations abandonnées |
| `WebhookEvent.completedAt` | Instant où le traitement a abouti ; `null` = réservé, issue inconnue | Postgres | aucune | — | conservé tant que `null` | distingue réservé de terminé |

⚠️ **Ces quatre lignes ne se suppriment pas.** `WebhookEvent` est un modèle
d'**infrastructure** livré par le squelette : il ne suppose rien du produit, et il survit à
l'initialisation. Un test (`apps/api/__tests__/documentation-claims.test.ts`) exige que tout
modèle Prisma figure ici — les retirer fait échouer `pnpm verify`.

Ajouter les données du produit **au-dessus**, au fur et à mesure.

## Données détenues par des tiers

| Donnée | Détenteur | Sensibilité | Remarque |
| --- | --- | --- | --- |
| Identité utilisateur (e-mail, nom, avatar) | Clerk | **personnelle** | ne pas dupliquer en base sans nécessité ni base légale |
| Appartenance organisation / rôle | Clerk | personnelle | source de vérité des permissions |
| Moyens de paiement, factures | Stripe | **financière** | ne jamais stocker de numéro de carte |
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
- **Contraintes** : préférer une contrainte de base à une vérification applicative — PostgreSQL applique les clés étrangères, s'en servir plutôt que de les émuler en code.
