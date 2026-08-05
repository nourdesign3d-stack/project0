import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readValue } from "./env-file.mjs";

/**
 * Résolution de `DATABASE_URL` et exécution des outils Postgres, partagées par
 * les scripts de sauvegarde et de restauration.
 *
 * Deux principes tiennent tout le reste :
 *
 *  1. **L'URL ne s'affiche jamais.** Elle contient un mot de passe. Les scripts
 *     n'en montrent que l'hôte et le nom de base — assez pour savoir sur quoi
 *     l'on agit, jamais assez pour s'en servir.
 *
 *  2. **Les outils viennent du conteneur.** `pg_dump` doit être au moins aussi
 *     récent que le serveur ; l'image de `compose.yml` l'est par construction.
 *     Cela évite d'exiger l'installation d'un client Postgres sur chaque poste,
 *     et surtout d'un client dont la version dériverait de celle du serveur.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATABASE_PACKAGE = join(root, "packages", "database");

const readIfPresent = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

/**
 * Même ordre de précédence que `packages/database/prisma.config.ts` : une
 * variable déjà présente dans l'environnement l'emporte, puis `.env.local` du
 * package, puis le `.env` racine. Diverger d'ici sauvegarderait une base et en
 * restaurerait une autre.
 */
export const databaseUrl = () => {
  const url =
    process.env.DATABASE_URL ||
    readValue(
      readIfPresent(join(DATABASE_PACKAGE, ".env.local")),
      "DATABASE_URL"
    ) ||
    readValue(readIfPresent(join(root, ".env")), "DATABASE_URL");

  if (!url) {
    throw new Error(
      "DATABASE_URL manquante. Renseigner packages/database/.env.local " +
        "(pnpm env:set DATABASE_URL) ou l'exporter avant de lancer la commande."
    );
  }

  return url;
};

/** Hôte et base, sans identifiants — ce qu'on peut afficher sans danger. */
export const describe = (url) => {
  try {
    const { hostname, pathname } = new URL(url);

    return `${hostname}${pathname}`;
  } catch {
    return "cible illisible";
  }
};

/**
 * Exécute une commande Postgres dans le conteneur de `compose.yml`.
 *
 * L'URL passe par l'environnement du conteneur et n'apparaît dans la commande
 * que sous la forme `"$TARGET_URL"` : un argument de ligne de commande est
 * visible de tout le système (`ps`), une variable d'environnement ne l'est pas.
 *
 * `command` est une chaîne littérale des scripts appelants — aucune valeur
 * fournie par l'utilisateur n'y est interpolée.
 */
export const runInContainer = (command, url, { input, capture } = {}) =>
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "-e",
      "TARGET_URL",
      "postgres",
      "sh",
      "-c",
      command,
    ],
    {
      cwd: root,
      env: { ...process.env, TARGET_URL: url },
      input,
      maxBuffer: 1024 * 1024 * 512,
      stdio: capture
        ? ["pipe", "pipe", "inherit"]
        : ["pipe", "inherit", "inherit"],
    }
  );
