---
description: Règles métier propres au produit. À compléter — ne rien inventer.
globs: ["apps/app/app/**", "packages/database/prisma/**"]
---

# Règles métier du projet

> **État : non défini.** Le dépôt vient d'être initialisé à partir de next-forge.
> Le seul modèle Prisma existant (`Page`) est un stub de démonstration.

## Ce qui est établi

- Le produit est une application SaaS multi-tenant : Clerk fournit utilisateurs **et
  organisations**. L'isolation entre organisations est donc un invariant structurant
  dès la première fonctionnalité métier.
- Les briques disponibles (paiement Stripe, notifications Knock, collaboration Liveblocks,
  e-mail Resend) sont **câblées mais pas utilisées** par une logique métier.

## Ce qui n'est pas établi

Aucun acteur, entité, état, transition, invariant ou règle de facturation n'a été défini.
**Ne pas inventer de règle métier.** En l'absence d'information :

1. poser la question au propriétaire du produit ;
2. si la réponse bloque le travail, consigner l'hypothèse dans `docs/ASSUMPTIONS.md`
   avec son impact si elle est fausse ;
3. implémenter le comportement le plus conservateur (refus par défaut, pas d'effet de
   bord irréversible).

## À compléter au fur et à mesure

Pour chaque capacité métier ajoutée, renseigner ici et dans `docs/DOMAIN_MODEL.md` :

- acteurs et rôles concernés ;
- entités et leur cycle de vie (états, transitions autorisées, transitions interdites) ;
- invariants (ce qui doit rester vrai **quoi qu'il arrive**) ;
- règles de permission (qui peut faire quoi, sur quelle ressource, dans quel état) ;
- effets irréversibles et leur protection (confirmation, idempotence, journal) ;
- règles de facturation ou de quota le cas échéant.
