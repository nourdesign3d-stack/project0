/**
 * Ce package fournit désormais uniquement les **en-têtes de sécurité**
 * (Nosecone, sans clé ni compte) — voir `proxy.ts`.
 *
 * La protection bot/WAF Arcjet a été retirée le 2026-08-05 : elle n'a jamais été
 * active faute de clé, et son offre ne correspondait pas au besoin exprimé.
 * Marche à suivre pour la remettre : docs/DECISIONS.md D-014.
 *
 * **Conséquence à assumer** : aucune protection contre les bots, aucun pare-feu
 * applicatif. Les routes publiques ou coûteuses doivent être protégées
 * autrement — limitation de débit (`@repo/rate-limit`), validation stricte des
 * entrées, bornes de taille, de durée et de fréquence. Voir docs/RISKS.md R-003.
 */

export { keys } from "./keys";
