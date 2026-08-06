import fs from "node:fs";
import type { MetadataRoute } from "next";
import { env } from "@/env";

const appFolders = fs.readdirSync("app", { withFileTypes: true });
const pages = appFolders
  .filter((file) => file.isDirectory())
  .filter((folder) => !folder.name.startsWith("_"))
  .filter((folder) => !folder.name.startsWith("("))
  .map((folder) => folder.name);

/**
 * Pages légales énumérées explicitement depuis le retrait du CMS (D-031).
 * Le parcours de dossiers ci-dessus ne descend que d'un niveau : ces routes
 * imbriquées lui échappent. Toute page ajoutée sous `legal/` doit figurer ici
 * **et** dans le pied de page, sinon elle existe sans être atteignable.
 */
const legalPages = ["legal/privacy", "legal/terms"];

const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith("https")
  ? "https"
  : "http";
const url = new URL(`${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL}`);

const sitemap = (): MetadataRoute.Sitemap => [
  {
    url: new URL("/", url).href,
    lastModified: new Date(),
  },
  ...pages.map((page) => ({
    url: new URL(page, url).href,
    lastModified: new Date(),
  })),
  ...legalPages.map((page) => ({
    url: new URL(page, url).href,
    lastModified: new Date(),
  })),
];

export default sitemap;
