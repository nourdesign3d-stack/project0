#!/usr/bin/env node
/**
 * Réinitialise une copie du dépôt pour un nouveau projet.
 *
 *   pnpm project:init --name mon-projet [--port 5432] [--dry-run]
 *
 * Ce que le script fait :
 *   - inscrit le nom dans package.json et le titre du README ;
 *   - remplace les documents « journal » de docs/ par leurs squelettes ;
 *   - écrit un .env racine (Docker Compose) avec le nom de base et le port ;
 *   - vide le graphe de dépendances généré.
 *
 * Ce que le script ne fait PAS, volontairement :
 *   - toucher à l'historique Git, aux remotes ou à quoi que ce soit de distant ;
 *   - supprimer des fichiers de code ;
 *   - installer des dépendances.
 * Ces étapes restent des décisions humaines : elles sont rappelées à la fin.
 */

import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Documents propres à un produit : remis à zéro. Les autres (ARCHITECTURE,
// SECURITY_MODEL, QUALITY_GATES, DEPLOYMENT) décrivent le squelette et sont conservés.
const JOURNAL = [
  "PROJECT_CONTEXT.md",
  "DOMAIN_MODEL.md",
  "DATA_DICTIONARY.md",
  "ASSUMPTIONS.md",
  "RISKS.md",
  "DECISIONS.md",
];

const parseArgs = (argv) => {
  const args = { dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--name" || arg === "--port") {
      args[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }

  return args;
};

const fail = (message) => {
  process.stderr.write(`\n  ✗ ${message}\n\n`);
  process.exit(1);
};

const args = parseArgs(process.argv.slice(2));
const name = args.name;
const port = args.port ?? "5432";

if (!name) {
  fail(
    "Nom manquant.\n    Usage : pnpm project:init --name mon-projet [--port 5433] [--dry-run]"
  );
}

if (!/^[a-z][a-z0-9-]{1,48}$/.test(name)) {
  fail(
    `Nom invalide : « ${name} ».\n    Attendu : minuscules, chiffres et tirets, commençant par une lettre.`
  );
}

if (!/^\d{2,5}$/.test(port)) {
  fail(`Port invalide : « ${port} ».`);
}

const actions = [];
const write = (path, content) => {
  actions.push(path);
  if (!args.dryRun) {
    writeFileSync(join(root, path), content);
  }
};

// 1. package.json
const packagePath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const previousName = pkg.name;
pkg.name = name;
write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

// 2. Titre du README (première ligne seulement : le reste est générique).
const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8").split("\n");
readme[0] = `# ${name}`;
write("README.md", readme.join("\n"));

// 3. Documents journal remplacés par leurs squelettes.
for (const file of JOURNAL) {
  const skeleton = join(root, "docs/_skeletons", file);

  if (!existsSync(skeleton)) {
    fail(`Squelette manquant : docs/_skeletons/${file}`);
  }

  actions.push(`docs/${file}`);
  if (!args.dryRun) {
    copyFileSync(skeleton, join(root, "docs", file));
  }
}

// 4. .env racine (lu par Docker Compose uniquement).
write(
  ".env",
  [
    "# Variables lues par Docker Compose uniquement (pas par les applications).",
    "# Généré par `pnpm project:init`. Non versionné.",
    `POSTGRES_DB=${name}`,
    `POSTGRES_PORT=${port}`,
    "",
  ].join("\n")
);

// 5. Graphe généré : appartient au projet précédent.
const graph = join(root, "docs/graph");
if (existsSync(graph)) {
  actions.push("docs/graph/ (supprimé)");
  if (!args.dryRun) {
    rmSync(graph, { recursive: true, force: true });
  }
}

const out = process.stdout;
out.write(
  `\n  ${args.dryRun ? "Simulation" : "Projet réinitialisé"} : ${previousName} → ${name}\n\n`
);
for (const action of actions) {
  out.write(`    ${args.dryRun ? "modifierait" : "écrit"}  ${action}\n`);
}

out.write(`
  Étapes restantes (manuelles, par décision) :

    1. Historique Git — repartir de zéro si la copie ne doit rien hériter :
         rm -rf .git && git init && git add -A && git commit -m "chore: initialisation"
       Sinon, vérifier le remote : git remote -v

    2. pnpm install && pnpm hooks:install

    3. docker compose up -d
       Port ${port} : vérifier qu'il est libre (lsof -nP -iTCP:${port} -sTCP:LISTEN)

    4. Renseigner les .env.local des apps (DATABASE_URL, NEXT_PUBLIC_APP_URL,
       NEXT_PUBLIC_WEB_URL au minimum) — voir docs/DEPLOYMENT.md

    5. pnpm verify   puis   pnpm graph

    6. Relire docs/ARCHITECTURE.md, SECURITY_MODEL.md, QUALITY_GATES.md et
       DEPLOYMENT.md : ils décrivent le squelette, pas encore votre produit.

`);
