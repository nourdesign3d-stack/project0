# Dictionnaire de données

Document vivant : chaque donnée importante manipulée par le produit y est décrite avant
d'être persistée ou envoyée à un tiers.

## Données persistées

| Donnée | Définition | Source de vérité | Sensibilité | Propriétaire | Conservation | Contraintes |
| --- | --- | --- | --- | --- | --- | --- |
| `WebhookEvent.provider` | Fournisseur émetteur (`clerk`, `stripe`) | Postgres | aucune | — | 30 jours après achèvement | partie de la clé primaire composite |
| `WebhookEvent.eventId` | Identifiant de **livraison** du fournisseur (`svix-id`, `evt_…`) | le fournisseur | interne | — | 30 jours après achèvement | partie de la clé primaire composite — c'est **elle** qui garantit l'idempotence, pas une vérification applicative |
| `WebhookEvent.receivedAt` | Instant de la réservation, remis à jour lors d'une reprise | Postgres | aucune | — | 30 jours après achèvement | indexé : sert la purge **et** la reprise des réservations abandonnées |
| `WebhookEvent.completedAt` | Instant où le traitement a abouti ; `null` = réservé, issue inconnue | Postgres | aucune | — | conservé tant que `null` | distingue réservé de terminé (D-049) |

Aucune donnée métier n'est encore persistée. Le modèle de démonstration `Page` a été **retiré le 2026-08-07** (D-070) : une graine qui livre une table de démonstration la fait supprimer par chaque projet dérivé. `WebhookEvent` est un modèle
d'**infrastructure** : il ne suppose rien du produit et ne porte aucune donnée
personnelle — un identifiant de livraison opaque, deux horodatages.

⚠️ **Une ligne dont `completedAt` reste `null` n'est jamais purgée**, volontairement :
c'est la trace d'un traitement qui ne s'est pas terminé, et c'est le seul incident de
cette table qui mérite d'être vu. La tâche `/cron/purge-webhook-events` les compte et les
journalise sans les supprimer.

## Données détenues par des tiers

| Donnée | Détenteur | Sensibilité | Remarque |
| --- | --- | --- | --- |
| Identité utilisateur (e-mail, nom, avatar) | Clerk | **personnelle** | ne pas dupliquer en base sans nécessité ni base légale |
| Appartenance organisation / rôle | Clerk | personnelle | source de vérité des permissions |
| Moyens de paiement, factures | Stripe | **financière** | ne jamais stocker de numéro de carte |
| Événements produit / analytics | PostHog, GA | pseudonymisée | ne pas y envoyer d'identifiant direct |
| Erreurs et traces | Sentry | **potentiellement sensible** | filtrer corps de requête, en-têtes, jetons |
| Journaux applicatifs | BetterStack (si configuré) | potentiellement sensible | ne pas journaliser de donnée personnelle inutile |

## Règles générales

- **Minimisation** : ne persister que ce qui est nécessaire à une règle métier écrite.
- **Source de vérité unique** : une donnée détenue par un tiers n'est pas recopiée en base
  « au cas où » ; si un cache est nécessaire, sa fraîcheur et son invalidation sont documentées ici.
- **Sensibilité** : `publique` / `interne` / `personnelle` / `financière` / `secret`.
  Toute donnée `personnelle`, `financière` ou `secret` implique : pas de log, pas d'URL,
  pas d'artefact CI, filtrage avant Sentry.
- **Conservation** : toute donnée personnelle doit avoir une durée de conservation et un
  moyen de suppression avant d'être introduite.
- **Contraintes** : préférer une contrainte de base à une vérification applicative
  (attention : `relationMode = "prisma"` désactive les clés étrangères — voir
  `.claude/rules/database.md`).

## À compléter

Pour chaque nouvelle entité : ajouter une ligne par champ significatif avant la migration.
