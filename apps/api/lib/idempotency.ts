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

// Prisma signale par ce code une suppression dont la cible n'existe pas.
const RECORD_NOT_FOUND = "P2025";

const isMissing = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === RECORD_NOT_FOUND;

/**
 * Libère la réservation quand le traitement a échoué : sans cela, l'événement
 * serait tenu pour traité et le réessai du fournisseur serait ignoré — une
 * perte silencieuse, exactement ce que l'idempotence est censée éviter.
 *
 * ⚠️ Cette fonction avalait **toute** erreur (`.catch(() => undefined)`). Or son
 * échec produit précisément la perte qu'elle existe pour empêcher : la
 * réservation survit, le réessai du fournisseur est pris pour un doublon, et
 * l'événement disparaît sans que rien ne le signale — le fournisseur, lui, a vu
 * un `200`. Relevé en audit le 2026-08-07 (D-041).
 *
 * Deux cas, désormais distingués :
 *
 *  - **`P2025`, la ligne n'existe pas** : sans conséquence, et attendu si deux
 *    chemins libèrent le même événement. Ignoré en silence.
 *  - **tout le reste** — base injoignable, contrainte, délai dépassé : journalisé
 *    avec le fournisseur et l'identifiant d'événement, seuls éléments permettant
 *    de retrouver ce qui a été perdu chez le fournisseur et de le rejouer à la
 *    main. L'erreur n'est pas propagée : l'appelant est déjà dans son chemin
 *    d'échec, et la masquer d'une seconde erreur ne l'aiderait pas.
 */
export const releaseEvent = async (
  provider: string,
  eventId: string
): Promise<void> => {
  try {
    await database.webhookEvent.delete({
      where: { provider_eventId: { provider, eventId } },
    });
  } catch (error) {
    if (isMissing(error)) {
      return;
    }

    log.error(
      `webhook ${provider} : réservation ${eventId} non libérée — le réessai ` +
        `du fournisseur sera pris pour un doublon et l'événement perdu. ` +
        parseError(error)
    );
  }
};
