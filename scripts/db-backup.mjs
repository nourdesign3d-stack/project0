#!/usr/bin/env node
/**
 * Sauvegarde la base désignée par `DATABASE_URL`.
 *
 *   pnpm db:backup
 *   pnpm db:backup --out sauvegardes/avant-migration.dump
 *
 * Format personnalisé (`-Fc`) : compressé, et surtout restaurable table par
 * table, ce qu'un fichier SQL brut ne permet pas.
 *
 * Ce que ce script **ne fait pas** : décider d'une fréquence, d'une rétention
 * ou d'un responsable. Ce sont des décisions de propriétaire, consignées dans
 * `docs/RECOVERY.md` — un outil ne remplace pas une politique.
 *
 * Une sauvegarde jamais restaurée n'est pas une sauvegarde. Voir `db:restore`,
 * et la répétition documentée dans `docs/RECOVERY.md`.
 */

import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { databaseUrl, describe, runInContainer } from "./lib/database-url.mjs";

const out = process.stdout;
const say = (text = "") => out.write(`${text}\n`);

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");

// Horodatage dans le nom : deux sauvegardes du même jour ne s'écrasent pas.
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target =
  outFlag === -1 ? join("sauvegardes", `${stamp}.dump`) : args[outFlag + 1];

if (!target) {
  say("\n  Usage : pnpm db:backup [--out <fichier>]\n");
  process.exit(1);
}

const path = isAbsolute(target) ? target : join(process.cwd(), target);

if (existsSync(path)) {
  // Écraser une sauvegarde est la meilleure façon de n'en avoir aucune.
  say(`\n  ${target} existe déjà — refus d'écraser une sauvegarde.\n`);
  process.exit(1);
}

let url;

try {
  url = databaseUrl();
} catch (error) {
  say(`\n  ${error.message}\n`);
  process.exit(1);
}

say("");
say(`  Source : ${describe(url)}`);
say(`  Cible  : ${target}`);
say("");

try {
  // `--no-owner --no-acl` : les rôles et privilèges de l'hébergeur ne voyagent
  // pas. Sans cela, un dump Neon porte `GRANT ... TO neon_superuser`, que toute
  // autre base refuse — la restauration « échoue » alors qu'elle a réussi.
  // Constaté à la première répétition réelle (D-027).
  const dump = runInContainer(
    'exec pg_dump "$TARGET_URL" --format=custom --no-owner --no-acl',
    url,
    { capture: true }
  );

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, dump);
  // Un dump contient l'intégralité des données : il se protège comme un secret.
  chmodSync(path, 0o600);

  say(`  ${dump.length} octets écrits, permissions 600.`);
  say("");
  say("  Une sauvegarde jamais restaurée n'est pas une sauvegarde :");
  say("  répéter la restauration avec pnpm db:restore. Voir docs/RECOVERY.md.");
  say("");
} catch (error) {
  say("  Sauvegarde échouée.");
  say("  Le conteneur Postgres est-il démarré ? docker compose up -d");
  say(`  ${String(error.message).split("\n")[0]}`);
  say("");
  process.exit(1);
}
