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
 *     Un comptage suffit à réveiller la connexion.
 */
export const GET = async (request: Request) => {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return new Response("Cron secret not configured", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await database.page.count();

  return new Response("OK", { status: 200 });
};
