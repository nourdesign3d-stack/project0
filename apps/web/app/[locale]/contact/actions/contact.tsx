"use server";

import { resend } from "@repo/email";
import { ContactTemplate } from "@repo/email/templates/contact";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { createRateLimiter, slidingWindow } from "@repo/rate-limit";
import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/env";

// Frontière publique et non authentifiée : tout est validé et borné avant
// d'atteindre un service tiers. Voir .claude/rules/security.md.
const CONTACT_INPUT = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(320),
  message: z.string().trim().min(1).max(5000),
});

/**
 * Messages destinés à l'utilisateur. Ce sont les **seuls** qui atteignent le
 * navigateur.
 *
 * ⚠️ L'action renvoyait auparavant `parseError(error)`, c'est-à-dire le message
 * de **toute** erreur survenue côté serveur. « Email is not configured. »
 * renseignait un visiteur anonyme sur l'état de configuration du serveur, et une
 * erreur remontée par le fournisseur d'e-mail partait telle quelle — nom d'hôte,
 * identifiant de compte, détail d'un refus. Relevé en audit le 2026-08-07
 * (D-054).
 */
const USER_MESSAGES = {
  invalid: "Merci de vérifier les champs du formulaire.",
  throttled: "Trop de demandes. Merci de réessayer plus tard.",
  unavailable: "L'envoi est momentanément indisponible. Merci de réessayer.",
} as const;

/**
 * Clé de limitation de débit.
 *
 * ⚠️ La version précédente employait `x-forwarded-for` **tel quel**. Trois
 * défauts en une ligne :
 *
 *  1. l'en-tête est fourni par le client — une valeur différente à chaque
 *     requête annulait purement et simplement la limite ;
 *  2. c'est une **liste** séparée par des virgules, dont la chaîne entière
 *     servait de clé : ajouter un saut suffisait à changer de seau ;
 *  3. absent, il donnait la clé `contact_form_null` — un seau **partagé par
 *     tous**, où le premier visiteur consommait le quota de tout le monde.
 *
 * Le premier élément de la liste est l'adresse vue par le proxy le plus
 * extérieur. Elle n'est digne de confiance que **derrière un proxy qui réécrit
 * l'en-tête** (Vercel le fait). Servie sans proxy, elle reste falsifiable : cette
 * limite est un garde-fou contre l'usage abusif ordinaire, pas contre un
 * attaquant déterminé — voir R-003.
 *
 * Sans en-tête, on refuse plutôt que de partager un seau : une requête non
 * attribuable ne doit pas consommer le quota d'autrui, ni bénéficier du sien.
 */
const rateLimitKey = (forwardedFor: string | null): string | null => {
  const first = forwardedFor?.split(",")[0]?.trim();

  return first && first.length > 0 ? `contact_form_${first}` : null;
};

export const contact = async (
  name: string,
  email: string,
  message: string
): Promise<{
  error?: string;
}> => {
  const parsed = CONTACT_INPUT.safeParse({ name, email, message });

  if (!parsed.success) {
    // Refus de validation : attendu, donc pas un incident. Le remonter à Sentry
    // offrirait à tout visiteur le moyen de saturer le canal (D-052).
    return { error: USER_MESSAGES.invalid };
  }

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const head = await headers();
    const key = rateLimitKey(head.get("x-forwarded-for"));

    if (!key) {
      return { error: USER_MESSAGES.throttled };
    }

    const rateLimiter = createRateLimiter({
      limiter: slidingWindow(1, "1d"),
    });

    const { success } = await rateLimiter.limit(key);

    if (!success) {
      return { error: USER_MESSAGES.throttled };
    }
  }

  if (!(resend && env.RESEND_FROM)) {
    // Configuration absente : le visiteur n'a pas à l'apprendre. Journalisé
    // côté serveur, où c'est une information d'exploitation utile.
    log.error("formulaire de contact : RESEND_FROM ou le client e-mail manque");

    return { error: USER_MESSAGES.unavailable };
  }

  try {
    await resend.emails.send({
      from: env.RESEND_FROM,
      to: env.RESEND_FROM,
      subject: "Contact form submission",
      replyTo: parsed.data.email,
      react: (
        <ContactTemplate
          email={parsed.data.email}
          message={parsed.data.message}
          name={parsed.data.name}
        />
      ),
    });

    return {};
  } catch (error) {
    // Échec du fournisseur : celui-là est un vrai incident, il part à Sentry.
    // Le message reste côté serveur ; le visiteur reçoit une phrase neutre.
    parseError(error);

    return { error: USER_MESSAGES.unavailable };
  }
};
