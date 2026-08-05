#!/usr/bin/env node
/**
 * Tests du lanceur `bin/vibe0.mjs`. Exécution : node bin/vibe0.test.mjs
 *
 * Ce lanceur crée des dossiers et clone un dépôt : ses **refus** sont la partie
 * qui compte. Un dossier non vide écrasé, ou la graine initialisée sur
 * elle-même, seraient des dégâts silencieux.
 *
 * Le cas nominal utilise une fausse graine minimale : on vérifie que le clone
 * a lieu et que la main est passée à l'amorçage, sans dérouler tout celui-ci.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const launcher = join(dirname(fileURLToPath(import.meta.url)), "vibe0.mjs");

/** Fausse graine : un dépôt Git avec juste ce que le lanceur exige. */
const makeSeed = () => {
  const seed = mkdtempSync(join(tmpdir(), "vibe0-seed-"));

  mkdirSync(join(seed, "scripts"), { recursive: true });
  writeFileSync(join(seed, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");
  // Amorçage factice : il signale seulement qu'il a été appelé.
  writeFileSync(
    join(seed, "scripts/vibe0.mjs"),
    'process.stdout.write("AMORCAGE APPELE\\n");\n'
  );

  const git = (...args) =>
    execFileSync("git", args, { cwd: seed, stdio: "ignore" });

  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  git("add", "-A");
  git("commit", "-q", "-m", "graine de test");

  return seed;
};

const launch = (seed, cwd, args = []) => {
  try {
    const stdout = execFileSync(process.execPath, [launcher, ...args], {
      cwd,
      env: { ...process.env, VIBE0_SEED: seed },
      stdio: "pipe",
    }).toString();
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, stderr: (error.stderr ?? "").toString() };
  }
};

const cases = [];
const check = (name, run) => cases.push({ name, run });
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

check("clone la graine et passe la main à l'amorçage", (seed, work) => {
  const target = join(work, "mon-projet");
  const result = launch(seed, work, [target]);

  assert(result.ok, `échec inattendu : ${result.stderr}`);
  assert(
    result.stdout.includes("AMORCAGE APPELE"),
    "l'amorçage du projet n'a pas été appelé"
  );
  assert(
    existsSync(join(target, "pnpm-workspace.yaml")),
    "le contenu de la graine n'a pas été cloné"
  );
  assert(existsSync(join(target, ".git")), "le clone n'a pas d'historique Git");
});

check("fonctionne depuis un dossier vide, sans argument", (seed, work) => {
  const target = join(work, "depuis-dedans");
  mkdirSync(target);

  const result = launch(seed, target);

  assert(result.ok, `échec inattendu : ${result.stderr}`);
  assert(
    existsSync(join(target, "pnpm-workspace.yaml")),
    "le clone n'a pas eu lieu dans le dossier courant"
  );
});

check("le remote hérité de la graine est retiré", (seed, work) => {
  const target = join(work, "sans-remote");
  const result = launch(seed, work, [target]);

  assert(result.ok, `échec inattendu : ${result.stderr}`);

  const remotes = execFileSync("git", ["remote"], { cwd: target })
    .toString()
    .trim();

  assert(
    remotes === "",
    `un push depuis le projet neuf viserait encore : ${remotes}`
  );
});

check("refuse une cible qui est un lien symbolique", (seed, work) => {
  const real = join(work, "cible-reelle");
  const link = join(work, "raccourci");

  mkdirSync(real);
  symlinkSync(real, link);

  const result = launch(seed, work, [link]);

  assert(!result.ok, "le clone a suivi le lien sans le signaler");
  assert(
    result.stderr.includes("lien symbolique"),
    `motif de refus inattendu : ${result.stderr}`
  );
  assert(
    readdirSync(real).length === 0,
    "le clone a écrit dans la cible réelle du lien"
  );
});

check("refuse un dossier non vide", (seed, work) => {
  const target = join(work, "deja-utilise");
  mkdirSync(target);
  writeFileSync(join(target, "travail.txt"), "ne pas écraser\n");

  const result = launch(seed, work, [target]);

  assert(!result.ok, "un dossier non vide a été accepté");
  assert(
    result.stderr.includes("n'est pas vide"),
    `motif de refus inattendu : ${result.stderr}`
  );
  assert(
    existsSync(join(target, "travail.txt")),
    "le fichier existant a été détruit"
  );
});

check("refuse un nom de dossier inutilisable", (seed, work) => {
  const target = join(work, "Nom Invalide");

  const result = launch(seed, work, [target]);

  assert(!result.ok, "un nom invalide a été accepté");
  assert(
    result.stderr.includes("inutilisable"),
    `motif de refus inattendu : ${result.stderr}`
  );
});

check("refuse de s'initialiser sur la graine elle-même", (seed) => {
  const result = launch(seed, seed, [seed]);

  assert(!result.ok, "la graine s'est initialisée sur elle-même");
  assert(
    result.stderr.includes("identique à la graine"),
    `motif de refus inattendu : ${result.stderr}`
  );
});

check("refuse une graine introuvable", (_seed, work) => {
  const result = launch(join(work, "graine-absente"), work, [
    join(work, "projet"),
  ]);

  assert(!result.ok, "une graine inexistante a été acceptée");
  assert(
    result.stderr.includes("introuvable"),
    `motif de refus inattendu : ${result.stderr}`
  );
});

check("refuse une graine qui n'est pas un dépôt Git", (_seed, work) => {
  const fake = join(work, "graine-sans-git");
  mkdirSync(fake, { recursive: true });
  writeFileSync(join(fake, "pnpm-workspace.yaml"), "packages: []\n");

  const result = launch(fake, work, [join(work, "projet2")]);

  assert(!result.ok, "une graine sans dépôt Git a été acceptée");
  assert(
    result.stderr.includes("dépôt Git"),
    `motif de refus inattendu : ${result.stderr}`
  );
});

let failures = 0;
const seed = makeSeed();

for (const { name, run } of cases) {
  const work = mkdtempSync(join(tmpdir(), "vibe0-work-"));

  try {
    run(seed, work);
  } catch (error) {
    failures += 1;
    process.stdout.write(`  ✗ ${name}\n      ${error.message}\n`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

rmSync(seed, { recursive: true, force: true });

process.stdout.write(
  failures === 0
    ? `  ${cases.length} cas vérifiés, aucun écart.\n`
    : `  ${failures} écart(s) sur ${cases.length} cas.\n`
);

process.exit(failures === 0 ? 0 : 1);
