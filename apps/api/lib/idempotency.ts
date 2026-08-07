import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";

/**
 * Idempotence des webhooks (R-012).
 *
 * Un fournisseur rejoue un événement dès qu'il doute de sa livraison : réessai
 * après un délai dépassé, après un `5xx`, ou simplement parce que le réseau a
 * hoqueté. Sans mémoire, chaque rejeu est retraité — analytics faussées,
 * effets de bord dupliqués, et pour un paiement, des conséquences réelles.
 *
 * Le contrôle est la **contrainte d'unicité** de `WebhookEvent`, pas une
 * vérification applicative : deux livraisons simultanées du même événement
 * atteindraient toutes deux un `findFirst` avant que l'une n'écrive.
 *
 * Ordre imposé : réserver **avant** de traiter. Réserver après laisserait une
 * fenêtre pendant laquelle un rejeu passerait.
 */

// Prisma signale une violation de contrainte d'unicité par ce code. Il est lu
// sur l'objet plutôt que par `instanceof` : le client est généré, et la classe
// d'erreur importée ne correspond pas toujours à celle levée à l'exécution.
const UNIQUE_VIOLATION = "P2002";

const isDuplicate = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === UNIQUE_VIOLATION;

/**
 * Délai au-delà duquel une réservation **non terminée** est tenue pour
 * abandonnée et peut être reprise.
 *
 * Quinze minutes : très au-delà de la durée d'un traitement de webhook (quelques
 * secondes), et en deçà de la fenêtre de réessai des fournisseurs. Trop court,
 * deux livraisons simultanées se marcheraient dessus ; trop long, un événement
 * resterait bloqué au-delà des réessais du fournisseur et serait perdu pour de
 * bon.
 */
const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Réserve l'événement. Renvoie `false` s'il a déjà été traité — l'appelant doit
 * alors acquitter sans rien refaire.
 *
 * ⚠️ Une ligne signifiait auparavant seulement « vu ». Un processus interrompu
 * **entre** la réservation et la fin — redéploiement, délai dépassé, arrêt du
 * conteneur — laissait donc une réservation que rien ne libérait : le réessai du
 * fournisseur était pris pour un doublon, et l'événement perdu en silence, le
 * fournisseur ayant reçu un `200`. Ni `releaseEvent` ni aucun autre dispositif
 * ne pouvait le rattraper, puisque le processus qui aurait dû libérer n'existait
 * plus. Relevé en audit le 2026-08-07 (D-049).
 *
 * `completedAt` distingue désormais **réservé** de **terminé**, et une
 * réservation abandonnée depuis plus de `STALE_AFTER_MS` est reprise.
 */
export const claimEvent = async (
  provider: string,
  eventId: string
): Promise<boolean> => {
  try {
    await database.webhookEvent.create({ data: { provider, eventId } });

    return true;
  } catch (error) {
    if (!isDuplicate(error)) {
      // Base injoignable, par exemple : ce n'est pas un doublon, et traiter
      // l'événement sans mémoire reviendrait à renoncer à l'idempotence en
      // silence. L'appelant doit échouer et laisser le fournisseur réessayer.
      throw error;
    }

    // Une ligne existe. Reprise **atomique** : le filtre et l'écriture sont dans
    // la même instruction, donc deux livraisons simultanées ne peuvent pas
    // reprendre la même réservation — l'une compte 1, l'autre 0. Un `findUnique`
    // suivi d'un `update` serait une course, pas un contrôle.
    const taken = await database.webhookEvent.updateMany({
      where: {
        provider,
        eventId,
        completedAt: null,
        receivedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
      },
      data: { receivedAt: new Date() },
    });

    if (taken.count === 1) {
      log.warn(
        `webhook ${provider} : réservation ${eventId} abandonnée, reprise — ` +
          "un traitement précédent ne s'est pas terminé"
      );

      return true;
    }

    return false;
  }
};

/**
 * Marque le traitement comme **abouti**. Sans cet appel, la réservation reste
 * indistinguable d'un traitement interrompu et sera reprise après
 * `STALE_AFTER_MS` — l'événement serait alors traité deux fois.
 *
 * L'échec est journalisé, pas propagé : le travail, lui, est fait. Propager
 * ferait répondre en erreur un traitement réussi, donc rejouer un effet de bord
 * déjà appliqué — l'inverse du but.
 */
export const completeEvent = async (
  provider: string,
  eventId: string
): Promise<void> => {
  try {
    await database.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { completedAt: new Date() },
    });
  } catch (error) {
    log.error(
      `webhook ${provider} : réservation ${eventId} non marquée terminée — ` +
        `elle sera reprise et l'événement retraité. ${parseError(error)}`
    );
  }
};

/**
 * Libère la réservation quand le traitement a échoué : sans cela, l'événement
 * serait tenu pour traité et le réessai du fournisseur serait ignoré — une
 * perte silencieuse, exactement ce que l'idempotence est censée éviter.
 */
export const releaseEvent = async (
  provider: string,
  eventId: string
): Promise<void> => {
  await database.webhookEvent
    .delete({ where: { provider_eventId: { provider, eventId } } })
    .catch(() => undefined);
};
