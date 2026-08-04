---
name: blind-spot-review
description: Analyse contradictoire d'un changement pour trouver les angles morts métier, sécurité, données, exploitation, performance et maintenance. À utiliser sur tout changement à risque avant livraison.
---

# Revue des angles morts

Exercice **contradictoire** : chercher activement ce qui a été oublié, pas confirmer ce
qui a été fait. Posture : « comment ce changement casse-t-il en production ? »

Parcourir les six axes. Pour chaque question, une réponse parmi : *traité* (où ?),
*non applicable* (pourquoi ?), *angle mort* (gravité).

## 1. Métier

- Une règle métier existante est-elle contournée par ce nouveau chemin ?
- Un état incohérent est-il atteignable (entité créée à moitié, statut orphelin) ?
- Une transition normalement interdite devient-elle possible ?
- Que se passe-t-il si l'utilisateur exécute l'action **deux fois** (double clic, retry, onglet) ?
- L'historique / la traçabilité est-il préservé, ou écrasé ?
- Le parcours peut-il être court-circuité (accès direct à une URL, appel d'API sans l'UI) ?

## 2. Sécurité

- Une autorisation manque-t-elle sur un chemin secondaire (export, webhook, cron, API) ?
- Un accès inter-tenant est-il possible via un identifiant deviné ou fourni par le client ?
- Une donnée sensible est-elle exposée en réponse, en log, en trace, en artefact CI ?
- Un secret peut-il fuiter (message d'erreur, source map, réponse d'erreur détaillée) ?
- Injection : SQL brut, HTML non échappé, redirection ouverte, chemin de fichier, prompt IA.
- Upload : type, taille, nom de fichier, stockage, accès ultérieur.
- Webhook : signature vérifiée, rejeu géré, payload malformé.
- Abus de ressources : la route est-elle limitée en débit, taille, durée, tentatives ?

## 3. Données

- La migration est-elle réversible ? A-t-elle été essayée sur un jeu de données réaliste ?
- Une contrainte manque-t-elle (unicité, non-null, index de relation) ?
  Rappel : `relationMode = "prisma"` → **aucune clé étrangère appliquée par la base**.
- Des doublons peuvent-ils apparaître en cas de retry ou de concurrence ?
- Les écritures liées sont-elles dans une transaction ?
- Une suppression est-elle définitive alors qu'elle devrait être logique ?
- Une restauration est-elle possible si l'opération se passe mal ?

## 4. Exploitation

- Que se passe-t-il si le fournisseur externe (Clerk, Stripe, Neon, Knock, BaseHub) est
  indisponible ou lent ? Timeout, retry borné, backoff, fallback ?
- Une tâche peut-elle rester bloquée sans que personne ne le sache ?
- L'échec est-il visible (Sentry, log) avec assez de contexte pour diagnostiquer ?
- Existe-t-il un moyen de rejouer ou de réparer manuellement ?
- Le changement est-il activable/désactivable indépendamment du déploiement ?

## 5. Performance

- Requêtes répétées en boucle (N+1) ?
- Liste sans pagination ni borne ?
- Poids ajouté au bundle client (dépendance lourde, `"use client"` trop haut) ?
- Traitement synchrone long dans une requête utilisateur ?
- Cache : durée, clé, invalidation — un contenu périmé ou privé peut-il être servi ?

## 6. Maintenabilité

- Duplication d'une logique déjà présente ailleurs ?
- Couplage nouveau entre modules qui n'avaient pas à se connaître ?
- Dépendance ajoutée alors qu'une capacité existante suffisait ?
- Frontière `apps`/`packages` violée ?
- Documentation, `.env.example` ou règles devenus faux à cause de ce changement ?

## Rendu

```
BLOQUANT     — livraison impossible en l'état
IMPORTANT    — à traiter avant livraison, ou ticket explicite accepté
AMÉLIORATION — souhaitable
NON VÉRIFIÉ  — non établi par cette revue (dire pourquoi)
```

Chaque constat : axe, fichier/ligne, **scénario concret d'échec**, correctif proposé.
Terminer par la liste des axes où aucun angle mort n'a été trouvé — l'absence de
constat doit être explicite, pas implicite.
