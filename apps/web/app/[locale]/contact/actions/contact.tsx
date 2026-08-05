"use server";

import { resend } from "@repo/email";
import { ContactTemplate } from "@repo/email/templates/contact";
import { parseError } from "@repo/observability/error";
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

export const contact = async (
  name: string,
  email: string,
  message: string
): Promise<{
  error?: string;
}> => {
  try {
    const parsed = CONTACT_INPUT.safeParse({ name, email, message });

    if (!parsed.success) {
      throw new Error("Invalid contact form submission.");
    }
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      const rateLimiter = createRateLimiter({
        limiter: slidingWindow(1, "1d"),
      });
      const head = await headers();
      const ip = head.get("x-forwarded-for");

      const { success } = await rateLimiter.limit(`contact_form_${ip}`);

      if (!success) {
        throw new Error(
          "You have reached your request limit. Please try again later."
        );
      }
    }

    if (!(resend && env.RESEND_FROM)) {
      throw new Error("Email is not configured.");
    }

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
    const errorMessage = parseError(error);

    return { error: errorMessage };
  }
};
