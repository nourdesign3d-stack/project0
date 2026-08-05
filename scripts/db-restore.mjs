#!/usr/bin/env node
/**
 * Restaure une sauvegarde — **opération destructive**.
 *
 *   pnpm db:restore sauvegardes/2026-08-05T18-00-00.dump --to local --yes
 *   pnpm db:restore <fichier> --to database-url --yes
 *
 * Deux garde-fous, et ils ne sont pas décoratifs :
 *
 *  1. **La cible est explicite.** `--to local` vise le Postgres de
 *     `compose.yml` ; `--to database-url` vise ce que désigne `DATABASE_URL`,
 *     c'est-à-dire potentiellement la base de production. Aucune valeur par
 *     défaut : se tromper de cible ici, c'est écraser ce qu'on voulait sauver.
 *
 *  2. **`--yes` est obligatoire.** Le script affiche l'hôte et la base visés,
 *     puis exige une confirmation explicite. Une restauration lancée par
 *     inadvertance dans un `&&` est exactement le scénario à empêcher.
 *
 * La répétition sérieuse consiste à restaurer **ailleurs** que sur la source :
 * `--to local` depuis une sauvegarde de production prouve la sauvegarde sans
 * toucher à la production. C'est la procédure décrite dans `docs/RECOVERY.md`.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { databaseUrl, describe, runInContainer } from "./lib/database-url.mjs";

const out = process.stdout;
const say = (text = "") => out.write(`${text}\n`);

// Base du conteneur de `compose.yml`, atteinte depuis l'intérieur du conteneur.
const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const [file, ...rest] = process.argv.slice(2);
const toFlag = rest.indexOf("--to");
const destination = toFlag === -1 ? "" : rest[toFlag + 1];
const confirmed = rest.includes("--yes");

if (!(file && ["local", "database-url"].includes(destination))) {
  say("");
  say("  Usage : pnpm db:restore <fichier> --to <local|database-url> --yes");
  say("");
  say("    --to local         le Postgres de compose.yml (répétition)");
  say("    --to database-url  ce que désigne DATABASE_URL — DESTRUCTIF");
  say("");
  process.exit(1);
}

const path = isAbsolute(file) ? file : join(process.cwd(), file);

if (!existsSync(path)) {
  say(`\n  Sauvegarde introuvable : ${file}\n`);
  process.exit(1);
}

let url;

try {
  url = destination === "local" ? LOCAL_URL : databaseUrl();
} catch (error) {
  say(`\n  ${error.message}\n`);
  process.exit(1);
}

say("");
say(`  Sauvegarde : ${file}`);
say(`  Cible      : ${describe(url)}`);
say("  Effet      : les objets existants seront remplacés.");
say("");

if (!confirmed) {
  say("  Rien n'a été fait : ajouter --yes pour confirmer.");
  say("  Vérifier la cible ci-dessus avant de le faire.");
  say("");
  process.exit(1);
}

try {
  // `--clean --if-exists` : la restauration doit être rejouable. Sans cela, une
  // seconde tentative échoue sur des objets déjà présents, au pire moment.
  runInContainer(
    'exec pg_restore --dbname "$TARGET_URL" --clean --if-exists --no-owner --no-acl',
    url,
    { input: readFileSync(path) }
  );

  say("");
  say("  Restauration terminée.");
  say("  Contrôler le résultat : nombre de lignes, migrations appliquées.");
  say("");
} catch (error) {
  // `pg_restore` sort en erreur dès qu'il **ignore** une instruction, même si
  // tout le reste est passé. Annoncer « échec » serait faux et dangereux : en
  // incident, on renoncerait à une restauration pourtant réussie. Le script dit
  // donc ce qu'il sait, et renvoie le contrôle à l'opérateur.
  say("");
  say(
    "  Restauration terminée avec des erreurs — ne pas conclure sans vérifier."
  );
  say("  pg_restore signale aussi bien un échec complet qu'une instruction");
  say(
    "  ignorée. Contrôler les tables et le nombre de lignes avant de décider."
  );
  say(`  ${String(error.message).split("\n")[0]}`);
  say("");
  process.exit(1);
}
