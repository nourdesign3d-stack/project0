import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

export const config: NextConfig = {
  // `X-Powered-By: Next.js` annonce la pile et sa version approximative à
  // quiconque interroge le serveur. Aucun bénéfice, un renseignement offert.
  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },

  /**
   * Proxy d'ingestion PostHog, servi sous le domaine de l'application.
   *
   * Sans lui, le navigateur appelle directement `*.i.posthog.com` — bloqué par
   * la plupart des bloqueurs de publicité, ce qui rend la mesure partielle et
   * silencieusement biaisée.
   *
   * ⚠️ La région était **codée en dur sur les États-Unis**. Pour un projet dont
   * les données doivent rester dans l'Union européenne, ce proxy envoyait donc
   * l'intégralité du trafic mesuré vers la mauvaise juridiction — et rien ne
   * l'indiquait. `POSTHOG_REGION` la rend explicite ; le défaut reste `eu`,
   * parce qu'un mauvais défaut de localisation coûte plus cher qu'un défaut
   * inutile. Relevé le 2026-08-07 (D-059).
   *
   * La région doit correspondre à celle du projet PostHog : une clé `phc_` créée
   * dans le nuage européen n'est pas reconnue par le point d'accès américain.
   */
  // biome-ignore lint/suspicious/useAwait: rewrites is async
  async rewrites() {
    const region = process.env.POSTHOG_REGION === "us" ? "us" : "eu";

    return [
      {
        source: "/ingest/static/:path*",
        destination: `https://${region}-assets.i.posthog.com/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `https://${region}.i.posthog.com/:path*`,
      },
      {
        source: "/ingest/decide",
        destination: `https://${region}.i.posthog.com/decide`,
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);
