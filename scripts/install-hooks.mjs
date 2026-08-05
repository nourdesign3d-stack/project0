#!/usr/bin/env node
/**
 * Active les hooks Git versionnés (`.githooks/`).
 *
 * Appelé automatiquement par le script `prepare` de pnpm, donc à chaque
 * `pnpm install` : un clone frais est protégé sans étape manuelle.
 *
 * Reste silencieux et sort en 0 si le dossier n'est pas un dépôt Git
 * (archive téléchargée, image Docker, CI sans historique) : ce n'est pas une
 * erreur, simplement un contexte où les hooks n'ont pas de sens.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const git = (...args) =>
  execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();

if (!existsSync(join(root, ".githooks"))) {
  process.exit(0);
}

try {
  git("rev-parse", "--git-dir");
} catch {
  // Pas un dépôt Git : rien à faire.
  process.exit(0);
}

try {
  const current = (() => {
    try {
      return git("config", "--get", "core.hooksPath");
    } catch {
      return "";
    }
  })();

  if (current !== ".githooks") {
    git("config", "core.hooksPath", ".githooks");
    process.stdout.write("  hooks Git activés (.githooks)\n");
  }

  // Contrôle final : ne jamais laisser croire que `main` est protégé si le
  // réglage n'a pas pris (verrou Git, permissions, configuration système).
  if (git("config", "--get", "core.hooksPath") !== ".githooks") {
    throw new Error("core.hooksPath n'a pas été appliqué");
  }
} catch (error) {
  // Dans un dépôt Git, un échec est un vrai problème : il faut le voir.
  process.stderr.write(
    `\n  ✗ hooks Git non activés : ${error instanceof Error ? error.message : String(error)}\n` +
      "    `main` n'est PAS protégé sur ce poste.\n" +
      "    Corriger puis relancer : pnpm hooks:install\n\n"
  );
  process.exit(1);
}

process.exit(0);
