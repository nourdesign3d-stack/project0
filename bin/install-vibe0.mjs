#!/usr/bin/env node
/**
 * Rend `vibe0` appelable depuis n'importe quel dossier.
 *
 *   pnpm vibe0:install
 *
 * Crée un lien symbolique vers `bin/vibe0.mjs` dans `~/.local/bin`. Rien d'autre :
 * pas de modification de votre shell, pas d'écriture hors de ce dossier.
 *
 * Pour désinstaller : rm ~/.local/bin/vibe0
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "vibe0.mjs");
const binDirectory = join(homedir(), ".local", "bin");
const link = join(binDirectory, "vibe0");
const out = process.stdout;

if (!existsSync(source)) {
  process.stderr.write(`\n  ✗ Introuvable : ${source}\n\n`);
  process.exit(1);
}

mkdirSync(binDirectory, { recursive: true });

if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) {
  const current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : null;

  if (current === source) {
    out.write(`\n  Déjà installé : ${link} → ${source}\n`);
  } else {
    // On ne remplace qu'un lien, jamais un vrai fichier : il pourrait être à quelqu'un d'autre.
    if (current === null) {
      process.stderr.write(
        `\n  ✗ ${link} existe et n'est pas un lien symbolique.\n` +
          "    Le déplacer ou le supprimer vous-même avant de relancer.\n\n"
      );
      process.exit(1);
    }

    unlinkSync(link);
    symlinkSync(source, link);
    out.write(`\n  Lien mis à jour : ${link} → ${source}\n`);
  }
} else {
  symlinkSync(source, link);
  out.write(`\n  Installé : ${link} → ${source}\n`);
}

const path = process.env.PATH ?? "";

if (!path.split(":").includes(binDirectory)) {
  out.write(
    `\n  ⚠️  ${binDirectory} n'est pas dans votre PATH. Ajouter à ~/.zshrc :\n\n` +
      `      export PATH="$HOME/.local/bin:$PATH"\n\n` +
      "    puis ouvrir un nouveau terminal.\n"
  );
}

out.write(`
  Utilisation, depuis n'importe où :

      mkdir mon-projet && cd mon-projet && vibe0
      vibe0 mon-projet          (depuis le dossier parent)

  La graine utilisée est ${resolve(dirname(source), "..")}.
  Pour en désigner une autre : export VIBE0_SEED=/chemin/vers/la/graine

`);
