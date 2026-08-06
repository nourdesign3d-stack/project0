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
 *  2. **La confirmation dépend de la cible.** `--to local` se contente de
 *     `--yes`. `--to database-url` exige en plus de **saisir le nom de la base**
 *     au terminal, et refuse tout net hors terminal.
 *
 *     `--yes` seul ne suffisait pas : lu dans le même `argv` que la cible, il
 *     laissait une ligne collée restaurer une base distante sans second geste
 *     humain — le scénario que cet en-tête prétendait empêcher. Relevé en audit
 *     le 2026-08-06 (D-039).
 *
 * La répétition sérieuse consiste à restaurer **ailleurs** que sur la source :
 * `--to local` depuis une sauvegarde de production prouve la sauvegarde sans
 * toucher à la production. C'est la procédure décrite dans `docs/RECOVERY.md`.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
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

/**
 * Pour la cible `database-url` — celle qui peut désigner la production — `--yes`
 * ne suffit pas.
 *
 * ⚠️ L'en-tête de ce script annonçait « le scénario à empêcher est un `&&` ».
 * Il ne l'empêchait pas : `--yes` était lu dans le **même `argv`** que
 * `--to database-url`, donc une seule ligne collée restaurait sans second geste
 * humain. Relevé en audit le 2026-08-06 (D-039).
 *
 * L'opérateur doit désormais **saisir le nom de la base** au terminal. Un nom
 * qu'on recopie ne se colle pas par inadvertance, et l'écrire oblige à regarder
 * la cible affichée juste au-dessus.
 */
if (destination === "database-url") {
  if (!process.stdin.isTTY) {
    say("  Cible database-url : confirmation interactive obligatoire.");
    say("  Ce script refuse de restaurer une base distante sans terminal —");
    say("  un enchaînement automatisé ne doit pas pouvoir la remplacer.");
    say("");
    process.exit(1);
  }

  const expected = describe(url).split("/").pop() ?? "";
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise((resolve) => {
    rl.question(
      `  Saisir le nom de la base pour confirmer (${expected}) : `,
      resolve
    );
  });

  rl.close();

  if (answer.trim() !== expected) {
    say("");
    say("  Nom incorrect : rien n'a été fait.");
    say("");
    process.exit(1);
  }
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
