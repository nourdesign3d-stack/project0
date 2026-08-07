#!/usr/bin/env node
/**
 * Crée les `.env.local` manquants à partir des `.env.example`.
 *
 *   pnpm env:setup [--force]
 *
 * Deux pièges du squelette sont traités ici, parce qu'ils bloquent le premier
 * démarrage et qu'aucun message d'erreur ne les explique :
 *
 *   1. Une variable **optionnelle** laissée à `""` échoue la validation Zod
 *      (`BETTERSTACK_URL=""` n'est pas une URL). Les lignes vides sont donc
 *      commentées plutôt que laissées telles quelles.
 *   2. `DATABASE_URL` est **requise** : elle est renseignée depuis le `.env`
 *      racine (POSTGRES_DB / POSTGRES_PORT), c'est-à-dire depuis le Postgres
 *      que `docker compose up -d` démarre.
 *
 * Sans `--force`, un `.env.local` existant n'est jamais écrasé : ces fichiers
 * contiennent des clés de service réelles.
 */

import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ENV_LINE = /^([A-Z_]+)=(.*)$/;
// Variable déclarée sans valeur : la commenter, sinon la validation Zod échoue.
const EMPTY_VALUE = /^[A-Z0-9_]+=""\s*$/;
const DATABASE_URL_LINE = /^#?\s*DATABASE_URL=/;
const force = process.argv.includes("--force");

const readRootEnv = () => {
  const path = join(root, ".env");
  const defaults = { POSTGRES_DB: "app", POSTGRES_PORT: "5432" };

  if (!existsSync(path)) {
    return defaults;
  }

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(ENV_LINE);
    if (match && match[1] in defaults) {
      defaults[match[1]] = match[2].trim();
    }
  }

  return defaults;
};

const { POSTGRES_DB, POSTGRES_PORT } = readRootEnv();
const databaseUrl = `postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`;

const workspaces = [];
for (const group of ["apps", "packages"]) {
  const base = join(root, group);
  if (!existsSync(base)) {
    continue;
  }
  for (const entry of readdirSync(base)) {
    if (existsSync(join(base, entry, ".env.example"))) {
      workspaces.push(join(group, entry));
    }
  }
}

const out = process.stdout;
const created = [];
const skipped = [];

for (const workspace of workspaces) {
  const target = join(root, workspace, ".env.local");

  if (existsSync(target) && !force) {
    skipped.push(workspace);
    continue;
  }

  const content = readFileSync(join(root, workspace, ".env.example"), "utf8")
    .split("\n")
    .map((line) => {
      // Variable sans valeur : commentée, sinon la validation Zod échoue.
      if (EMPTY_VALUE.test(line)) {
        return `# ${line}`;
      }
      return line;
    })
    .map((line) =>
      // Seule variable dont on connaît la valeur en local.
      DATABASE_URL_LINE.test(line) ? `DATABASE_URL="${databaseUrl}"` : line
    )
    .join("\n");

  // 0600 : ces fichiers reçoivent des clés de service dès le premier usage.
  writeFileSync(target, content, { mode: 0o600 });
  chmodSync(target, 0o600);
  created.push(workspace);
}

out.write("\n");
for (const workspace of created) {
  out.write(`    créé     ${workspace}/.env.local\n`);
}
for (const workspace of skipped) {
  out.write(`    conservé ${workspace}/.env.local (déjà présent)\n`);
}

if (created.length > 0) {
  out.write(`
    DATABASE_URL pointe sur ${databaseUrl}
    → démarrer la base : docker compose up -d

    Les variables des services tiers (Clerk, Stripe, Resend, Sentry…) sont
    commentées : les décommenter au fur et à mesure, avec de vraies clés.
    Sans clé Clerk, l'application démarre mais les pages d'authentification
    ne s'affichent pas.
`);
}

out.write("\n");
