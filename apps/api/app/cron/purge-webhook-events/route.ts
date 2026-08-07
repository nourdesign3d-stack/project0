import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";

/**
 * Purge la mémoire d'idempotence des webhooks.
 *
 * `WebhookEvent` ne croît **que**. Une ligne par livraison, jamais supprimée :
 * la table grandit indéfiniment, et avec elle le coût de chaque réservation.
 * Rien ne l'aurait signalé — c'est le genre de dette qui ne se manifeste qu'en
 * production, tard, sous la forme d'une latence inexpliquée. Relevé en audit le
 * 2026-08-07 (D-049).
 *
 * **Ce qui borne la rétention n'est pas un choix esthétique** : une ligne ne
 * protège de rien une fois passée la fenêtre de réessai du fournisseur. Stripe
 * réessaie jusqu'à 3 jours, Svix jusqu'à environ 5 : au-delà de 30 jours, aucun
 * rejeu légitime ne peut plus arriver, et conserver la ligne ne fait
 * qu'alourdir la table.
 *
 * ⚠️ Seules les lignes **terminées** sont purgées. Une réservation jamais
 * aboutie est une anomalie : la supprimer effacerait la trace du seul incident
 * qui mérite d'être vu. Elle est reprise par `claimEvent` après son délai de
 * péremption, et le compte des lignes restantes est journalisé pour qu'une
 * accumulation se remarque.
 *
 * Même authentification que `keep-alive` : la route est publiquement joignable,
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`. Refus par défaut.
 */

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const GET = async (request: Request) => {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return new Response("Cron secret not configured", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const before = new Date(Date.now() - RETENTION_DAYS * MS_PER_DAY);

  try {
    const { count } = await database.webhookEvent.deleteMany({
      where: { completedAt: { not: null, lt: before } },
    });

    // Une réservation ancienne et non terminée est une anomalie : la compter la
    // rend visible sans rien détruire.
    const stale = await database.webhookEvent.count({
      where: { completedAt: null, receivedAt: { lt: before } },
    });

    if (stale > 0) {
      log.warn(
        `purge des webhooks : ${stale} réservation(s) jamais terminée(s) et ` +
          `antérieure(s) à ${RETENTION_DAYS} jours — conservées pour examen`
      );
    }

    log.info(`purge des webhooks : ${count} ligne(s) supprimée(s)`);

    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error(`purge des webhooks en échec — ${parseError(error)}`);

    return new Response("Purge failed", { status: 503 });
  }
};
