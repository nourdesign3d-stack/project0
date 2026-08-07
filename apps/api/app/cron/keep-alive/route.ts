import { database } from "@repo/database";

/**
 * Maintient la connexion à la base éveillée (Neon met en veille les instances
 * inactives). Déclenché par le cron Vercel déclaré dans vercel.json.
 *
 * Deux exigences, absentes de la version d'origine du template :
 *
 *  1. **Authentification.** La route est publiquement joignable. Vercel Cron
 *     envoie `Authorization: Bearer $CRON_SECRET` ; sans secret configuré ou
 *     sans correspondance, on refuse. Refus par défaut.
 *
 *  2. **Lecture seule.** La version d'origine créait puis supprimait une ligne
 *     `Page` à chaque appel : n'importe qui pouvait déclencher des écritures en
 *     boucle, et une suppression échouée laissait des lignes orphelines.
 *
 *  3. **Indépendante du schéma.** Le comptage qui a remplacé ces écritures
 *     portait sur `Page` — le modèle de démonstration que `DOMAIN_MODEL.md`
 *     prescrit de supprimer. Le jour où quelqu'un suit cette consigne, la tâche
 *     planifiée cesse de compiler et la base retombe en veille, sans qu'aucun
 *     document ne relie les deux. Relevé en audit le 2026-08-07 (D-050).
 *
 *     `SELECT 1` réveille la connexion sans rien supposer du contenu de la base.
 */
export const GET = async (request: Request) => {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return new Response("Cron secret not configured", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Requête littérale, sans aucune interpolation : rien de ce qui vient de la
  // requête HTTP n'y entre. C'est le seul usage de SQL brut du dépôt, et il
  // existe précisément pour ne dépendre d'aucune table.
  await database.$queryRaw`SELECT 1`;

  return new Response("OK", { status: 200 });
};
