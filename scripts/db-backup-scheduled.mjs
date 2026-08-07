#!/usr/bin/env node
/**
 * Sauvegarde **automatisable** : produit un dump, applique la rétention, et
 * échoue bruyamment.
 *
 *   pnpm db:backup:scheduled
 *
 * Destination : `$BACKUP_DIR`, ou `~/Sauvegardes/<nom du dépôt>` par défaut.
 * Elle doit être **hors du dépôt** — un dump versionné par inadvertance est une
 * fuite de toutes les données du produit.
 *
 * ── Ce qui distingue ce script de `db:backup` ──
 *
 * `db:backup` est un geste manuel : il écrit un fichier et s'arrête. Celui-ci
 * est fait pour tourner sans témoin, ce qui change trois choses :
 *
 *  1. **il applique la rétention** (`lib/retention.mjs`) — sinon le dossier
 *     croît indéfiniment jusqu'à saturer le disque, et une sauvegarde qui
 *     remplit le disque finit par empêcher les suivantes ;
 *  2. **il laisse une trace de succès** (`.derniere-reussite`) — sans quoi rien
 *     ne distingue « a tourné et réussi » de « n'a jamais tourné » ;
 *  3. **il crie quand il échoue** — journal, notification système, et code de
 *     sortie non nul.
 *
 * ⚠️ **Le silence n'est pas un succès.** Une notification ne se déclenche que si
 * le script s'exécute : elle attrape les échecs, jamais les **absences**
 * d'exécution — machine éteinte, agent déchargé, portable en veille. Le seul
 * dispositif qui attrape une absence est extérieur à la machine : un moniteur de
 * pulsation. Renseigner `BACKUP_HEARTBEAT_URL` pour en appeler un après chaque
 * succès ; sans lui, une interruption prolongée reste invisible. Voir
 * `docs/RECOVERY.md`.
 */

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { databaseUrl, describe, runInContainer } from "./lib/database-url.mjs";
import { applyRetention, dateFromName } from "./lib/retention.mjs";

const out = process.stdout;
const say = (text = "") => out.write(`${text}\n`);

const root = process.cwd();
const destination =
  process.env.BACKUP_DIR || join(homedir(), "Sauvegardes", basename(root));

const LOG = join(destination, "journal.log");
const HEARTBEAT_FILE = join(destination, ".derniere-reussite");

const trace = (line) => {
  const stamped = `${new Date().toISOString()} ${line}\n`;

  try {
    appendFileSync(LOG, stamped);
  } catch {
    // Le journal ne doit jamais faire échouer la sauvegarde elle-même.
  }

  say(`  ${line}`);
};

/**
 * Notification système. `osascript` n'existe que sur macOS ; ailleurs, le
 * journal et le code de sortie suffisent — on ne fait pas semblant d'alerter.
 */
const notify = (message) => {
  if (process.platform !== "darwin") {
    return;
  }

  try {
    execFileSync("osascript", [
      "-e",
      `display notification ${JSON.stringify(message)} with title "Sauvegarde de base"`,
    ]);
  } catch {
    // Une notification impossible ne doit pas masquer l'erreur d'origine.
  }
};

const fail = (message, detail) => {
  trace(`ÉCHEC — ${message}`);

  if (detail) {
    trace(`  ${String(detail).split("\n")[0]}`);
  }

  notify(message);
  process.exit(1);
};

mkdirSync(destination, { recursive: true });

let url;

try {
  url = databaseUrl();
} catch (error) {
  fail("DATABASE_URL introuvable", error.message);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const path = join(destination, `${stamp}.dump`);

let written = 0;

try {
  const dump = runInContainer(
    'exec pg_dump "$TARGET_URL" --format=custom --no-owner --no-acl',
    url,
    { capture: true }
  );

  if (dump.length === 0) {
    // Un dump vide est un échec qui se présente comme un succès : `pg_dump`
    // peut sortir en 0 sans rien produire si la connexion tombe au mauvais
    // moment. Écrire ce fichier reviendrait à archiver du vide.
    fail("dump vide — rien n'a été écrit");
  }

  writeFileSync(path, dump);
  // Un dump contient l'intégralité des données : il se protège comme un secret.
  chmodSync(path, 0o600);
  written = dump.length;
} catch (error) {
  fail("sauvegarde impossible", error.message);
}

trace(`OK — ${describe(url)} → ${basename(path)} (${written} octets)`);

// --- Rétention --------------------------------------------------------------

try {
  const entries = readdirSync(destination)
    .map((name) => ({ name, date: dateFromName(name) }))
    .filter((entry) => entry.date !== null);

  const { remove } = applyRetention(entries, new Date());

  for (const name of remove) {
    rmSync(join(destination, name), { force: true });
  }

  if (remove.length > 0) {
    trace(
      `rétention — ${remove.length} sauvegarde(s) ancienne(s) supprimée(s)`
    );
  }
} catch (error) {
  // La rétention échoue : la sauvegarde du jour, elle, est faite. On le signale
  // sans effacer ce succès — le disque qui se remplit est un problème plus lent
  // qu'une sauvegarde manquante.
  trace(`AVERTISSEMENT — rétention non appliquée : ${error.message}`);
  notify("rétention des sauvegardes non appliquée");
}

// --- Preuve de vie ----------------------------------------------------------

writeFileSync(HEARTBEAT_FILE, `${new Date().toISOString()}\n`);

const heartbeat = process.env.BACKUP_HEARTBEAT_URL;

if (heartbeat) {
  try {
    await fetch(heartbeat, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    // Le moniteur ne répond pas : la sauvegarde est faite, mais l'absence de
    // pulsation déclenchera une alerte à distance. C'est le comportement voulu.
    trace(`AVERTISSEMENT — pulsation non émise : ${error.message}`);
  }
}

say("");
