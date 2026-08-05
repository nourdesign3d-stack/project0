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
  // Run security headers first
  const headersResponse = securityHeaders();

  // Then run composed middleware (i18n)
  const middlewareResponse = await composedMiddleware(
    // La requête fournie par Clerk n'expose pas le type NextRequest attendu par
    // createNEMO ; conversion imposée par next-forge.
    // nosemgrep: local-no-ts-suppression
    request as unknown as NextRequest,
    event
  );

  // Return middleware response if it exists, otherwise headers response
  return middlewareResponse || headersResponse;
  // nosemgrep: local-no-ts-suppression -- même motif que apps/app/proxy.ts.
}) as unknown as NextProxy;
