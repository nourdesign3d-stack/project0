import { authMiddleware } from "@repo/auth/proxy";
import { internationalizationMiddleware } from "@repo/internationalization/proxy";
import {
  noseconeOptions,
  noseconeOptionsWithToolbar,
  securityMiddleware,
} from "@repo/security/proxy";
import { createNEMO } from "@rescale/nemo";
import type { NextProxy, NextRequest } from "next/server";
import { env } from "@/env";

export const config = {
  // matcher tells Next.js which routes to run the middleware on. This runs the
  // middleware on all routes except for static assets and Posthog ingest
  matcher: [
    "/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};

const securityHeaders = env.FLAGS_SECRET
  ? securityMiddleware(noseconeOptionsWithToolbar)
  : securityMiddleware(noseconeOptions);

// Compose non-Clerk middleware with Nemo
const composedMiddleware = createNEMO(
  {},
  {
    before: [internationalizationMiddleware],
  }
);

// Clerk middleware wraps other middleware in its callback
export default authMiddleware(async (_auth, request, event) => {
  const headersResponse = await securityHeaders();

  // Puis le middleware composé (i18n)
  const middlewareResponse = await composedMiddleware(
    // La requête fournie par Clerk n'expose pas le type NextRequest attendu par
    // createNEMO ; conversion imposée par next-forge.
    // nosemgrep: local-no-ts-suppression
    request as unknown as NextRequest,
    event
  );

  if (!middlewareResponse) {
    return headersResponse;
  }

  /**
   * ⚠️ Le code d'origine renvoyait `middlewareResponse || headersResponse`.
   * Le middleware d'internationalisation renvoie **toujours** quelque chose —
   * une réécriture pour `/`, une redirection pour `/en/...` — donc les en-têtes
   * de sécurité étaient **systématiquement jetés**. Mesuré le 2026-08-06 : le
   * site public ne servait aucun en-tête, alors que `SECURITY_MODEL.md` les
   * déclarait actifs (D-034).
   *
   * Les en-têtes existants de la réponse d'i18n sont préservés : on complète,
   * on n'écrase pas.
   */
  for (const [key, value] of headersResponse.headers) {
    if (!middlewareResponse.headers.has(key)) {
      middlewareResponse.headers.set(key, value);
    }
  }

  return middlewareResponse;
  // nosemgrep: local-no-ts-suppression -- même motif que apps/app/proxy.ts.
}) as unknown as NextProxy;
