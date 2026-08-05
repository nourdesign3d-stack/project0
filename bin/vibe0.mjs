#!/usr/bin/env node
/**
 * vibe0 — créer un projet à partir de la graine, depuis n'importe où.
 *
 *   mkdir mon-projet && cd mon-projet && vibe0
 *   vibe0 mon-projet          (depuis le dossier parent)
 *
 * Ce script ne fait qu'une chose de plus que `pnpm vibe0` : il **apporte la
 * graine**. Il clone le dépôt de référence dans le dossier cible, puis passe la
 * main à l'amorçage interactif du projet cloné.
 *
 * Pourquoi `git clone` et non une copie de dossier : une copie brute emporte les
 * fichiers non versionnés — .env.local (clés réelles et base de données du projet
 * source), .clerk, et un cache .turbo de plusieurs gigaoctets. Le clone ne prend
 * que ce qui est versionné.
 *
 * Emplacement de la graine, par ordre de priorité :
 *   1. variable d'environnement VIBE0_SEED
 *   2. ~/Project0
 *
 * Installation : voir README.md, section « Repartir de ce dépôt ».
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,48}$/;

const fail = (message, hint) => {
  process.stderr.write(`\n  ✗ ${message}\n${hint ? `    ${hint}\n` : ""}\n`);
  process.exit(1);
};

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });

// --- Où est la graine ? -----------------------------------------------------

// Le script vit dans <graine>/bin/ : sa propre position est le meilleur indice.
const fromSelf = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const findSeed = () => {
  if (process.env.VIBE0_SEED) {
    return resolve(process.env.VIBE0_SEED);
  }

  if (existsSync(join(fromSelf, "pnpm-workspace.yaml"))) {
    return fromSelf;
  }

  return join(homedir(), "Project0");
};

const seed = findSeed();

if (!existsSync(join(seed, "pnpm-workspace.yaml"))) {
  fail(
    `Graine introuvable : ${seed}`,
    "Définir VIBE0_SEED avec le chemin du dépôt de référence."
  );
}

if (!existsSync(join(seed, ".git"))) {
  fail(
    `La graine ${seed} n'est pas un dépôt Git.`,
    "Le clone est le seul mode de copie sûr : `git init` puis un premier commit."
  );
}

// --- Où va le projet ? ------------------------------------------------------

const argument = process.argv[2];
const target = argument ? resolve(process.cwd(), argument) : process.cwd();
const name = basename(target).toLowerCase();

if (!NAME_PATTERN.test(name)) {
  fail(
    `Nom de dossier inutilisable comme nom de projet : « ${basename(target)} ».`,
    "Attendu : minuscules, chiffres et tirets, commençant par une lettre."
  );
}

if (resolve(target) === resolve(seed)) {
  fail(
    "Cible identique à la graine.",
    "Créer le projet ailleurs : la graine ne s'initialise pas elle-même."
  );
}

if (existsSync(target)) {
  // `lstat` et non `stat` : un lien symbolique vers un dossier vide faisait
  // écrire le clone dans sa cible réelle, sans que rien ne le signale.
  if (lstatSync(target).isSymbolicLink()) {
    fail(
      `${target} est un lien symbolique.`,
      "vibe0 écrirait ailleurs que là où vous croyez. Viser le dossier réel."
    );
  }

  if (!statSync(target).isDirectory()) {
    fail(`${target} existe et n'est pas un dossier.`);
  }

  const entries = readdirSync(target).filter((entry) => entry !== ".DS_Store");

  if (entries.length > 0) {
    fail(
      `Le dossier ${target} n'est pas vide (${entries.length} entrées).`,
      "vibe0 ne travaille que dans un dossier vide : rien n'est écrasé."
    );
  }
} else {
  mkdirSync(target, { recursive: true });
}

// --- Clone puis passage de relais -------------------------------------------

const out = process.stdout;
out.write(`\n  Graine   : ${seed}\n  Projet   : ${target}\n\n  Clonage…\n`);

// --no-hardlinks : les objets du nouveau dépôt sont indépendants de la graine,
// qui peut être déplacée ou supprimée sans l'abîmer.
run(
  "git",
  ["clone", "--local", "--no-hardlinks", "--quiet", seed, target],
  process.cwd()
);

// Le clone hérite d'un `origin` qui pointe sur la graine : un `git push` depuis
// le projet neuf écrirait dans le dépôt de référence. On coupe le lien ; la
// commande pour le rétablir est rappelée en fin de parcours.
try {
  run("git", ["remote", "remove", "origin"], target);
} catch {
  // Pas de remote à retirer : rien à faire.
}

const init = join(target, "scripts/vibe0.mjs");

if (!existsSync(init)) {
  fail(
    "Le dépôt cloné ne contient pas scripts/vibe0.mjs.",
    "La graine n'est probablement pas à jour."
  );
}

out.write("  Clone terminé. Amorçage du projet…\n");
run(process.execPath, [init], target);

out.write(
  `\n  Le projet est dans ${target}\n` +
    "  Le remote hérité de la graine a été retiré : un push accidentel ne peut\n" +
    `  plus atteindre ${seed}.\n\n`
);
