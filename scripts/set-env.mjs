#!/usr/bin/env node
/**
 * Renseigne une variable d'environnement dans tous les `.env.local` du dépôt qui
 * la déclarent — sans qu'elle transite par l'historique du shell, ni par une
 * capture d'écran, ni par un agent.
 *
 *   pnpm env:set DATABASE_URL
 *   pnpm env:set STRIPE_SECRET_KEY --root ~/un-autre-projet
 *
 * Motivation : les `.env.local` sont des fichiers cachés, répartis dans plusieurs
 * workspaces. Les éditer un par un est pénible, et le raccourci qui vient à
 * l'esprit — `echo "…" >> .env.local` — inscrit la valeur dans l'historique du
 * shell, où elle survit à la session.
 *
 * Ce que le script ne fait jamais : afficher la valeur saisie, la journaliser,
 * l'écrire ailleurs que dans les fichiers concernés, ou toucher un fichier qui
 * ne déclare pas déjà la variable (créer une variable là où elle n'est pas
 * attendue casserait la validation Zod plutôt que de l'aider).
 */

import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { declares, withValue } from "./lib/env-file.mjs";

const VARIABLE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "dist",
  "generated",
  "node_modules",
]);

const out = process.stdout;
const say = (text = "") => out.write(`${text}\n`);

const [variable, ...rest] = process.argv.slice(2);
const rootFlag = rest.indexOf("--root");
const root =
  rootFlag === -1
    ? join(dirname(fileURLToPath(import.meta.url)), "..")
    : rest[rootFlag + 1];

if (!(variable && VARIABLE_PATTERN.test(variable))) {
  say("");
  say("  Usage : pnpm env:set <VARIABLE> [--root <dossier>]");
  say("  Exemple : pnpm env:set DATABASE_URL");
  say("");
  process.exit(1);
}

if (!(root && existsSync(root))) {
  say(`\n  Dossier introuvable : ${root}\n`);
  process.exit(1);
}

/** Tous les `.env.local` du dépôt, caches et dépendances exclus. */
const collect = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : collect(path);
    }

    return entry.name === ".env.local" ? [path] : [];
  });
};

const targets = collect(root).filter((path) =>
  declares(readFileSync(path, "utf8"), variable)
);

if (targets.length === 0) {
  say(`\n  Aucun .env.local ne déclare ${variable}.`);
  say("  Vérifier le nom, ou l'ajouter d'abord au .env.example concerné.\n");
  process.exit(1);
}

say("");
say(`  ${variable} sera écrite dans ${targets.length} fichier(s) :`);

for (const path of targets) {
  say(`    ${relative(root, path)}`);
}

say("");

// Contrôlé **après** la recherche : une variable mal orthographiée doit être
// signalée même hors terminal, plutôt que masquée par l'exigence de TTY.
if (!process.stdin.isTTY) {
  process.stderr.write(
    "  env:set est interactif : le lancer depuis un terminal.\n" +
      "  Sans TTY, la valeur ne peut pas être saisie en masqué.\n\n"
  );
  process.exit(1);
}

// Sortie que l'on peut rendre muette le temps de la saisie. Une seule interface
// readline : mélanger readline et une lecture manuelle en mode brut sur le même
// stdin met stdin en pause et laisse la promesse non résolue.
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!output.muted) {
      process.stdout.write(chunk, encoding);
    }

    callback();
  },
});

const rl = createInterface({
  input: process.stdin,
  output,
  terminal: true,
});

const value = await new Promise((resolve) => {
  rl.question(`  Valeur de ${variable} (saisie masquée) : `, (answer) => {
    output.muted = false;
    process.stdout.write("\n");
    resolve(answer.trim());
  });

  output.muted = true;
});

rl.close();

if (!value) {
  say("  Aucune valeur saisie — rien n'a été modifié.\n");
  process.exit(1);
}

if (value.includes("\n")) {
  say("  La valeur contient un retour à la ligne — refusé.\n");
  process.exit(1);
}

for (const path of targets) {
  const content = readFileSync(path, "utf8");

  writeFileSync(path, withValue(content, variable, value), "utf8");
  chmodSync(path, 0o600);
}

say(`  ${variable} écrite dans ${targets.length} fichier(s), permissions 600.`);
say("  La valeur n'a été ni affichée, ni journalisée.");
say("");
