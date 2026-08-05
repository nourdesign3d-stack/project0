import { database } from "@repo/database";

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
 * Réserve l'événement. Renvoie `false` s'il a déjà été traité — l'appelant doit
 * alors acquitter sans rien refaire.
 */
export const claimEvent = async (
  provider: string,
  eventId: string
): Promise<boolean> => {
  try {
    await database.webhookEvent.create({ data: { provider, eventId } });

    return true;
  } catch (error) {
    if (isDuplicate(error)) {
      return false;
    }

    // Base injoignable, par exemple : ce n'est pas un doublon, et traiter
    // l'événement sans mémoire reviendrait à renoncer à l'idempotence en
    // silence. L'appelant doit échouer et laisser le fournisseur réessayer.
    throw error;
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
