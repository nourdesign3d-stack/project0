import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";

/**
 * `apps/api` n'avait **aucun** middleware : `/health`, `/cron/keep-alive` et les
 * webhooks répondaient sans le moindre en-tête de sécurité. Mesuré le
 * 2026-08-06 (D-034), alors que `SECURITY_MODEL.md` déclarait Nosecone actif.
 *
 * Cette app ne sert que du JSON, ce qui limite l'intérêt de certains en-têtes —
 * mais `X-Content-Type-Options`, `Strict-Transport-Security` et
 * `Referrer-Policy` valent pour toute réponse HTTP, quelle qu'en soit la forme.
 *
 * Pas de barre d'outils Vercel ici : cette app n'a pas d'interface.
 */
export default securityMiddleware(noseconeOptions);

export const config = {
  // Toutes les routes : elles sont toutes des points d'entrée publics.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
