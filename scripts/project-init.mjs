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

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readdirSync,
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

const FLAGS = {
  "--dry-run": "dryRun",
  "--keep-docs": "keepDocs",
  // Régénère les fichiers d'environnement même si le nom ne change pas.
  "--fresh": "fresh",
  // Conserve les fichiers d'environnement existants, en connaissance de cause.
  "--keep-env": "keepEnv",
};

const parseArgs = (argv) => {
  const args = { dryRun: false, keepDocs: false, fresh: false, keepEnv: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FLAGS[arg]) {
      args[FLAGS[arg]] = true;
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

// 3. Documents journal remplacés par leurs squelettes (sauf --keep-docs).
for (const file of args.keepDocs ? [] : JOURNAL) {
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

// 6. Résidus du projet source.
//
// Une copie de dossier transporte les fichiers non versionnés : environnements
// locaux (clés réelles et base de données du projet précédent), instance Clerk
// éphémère, caches de build de plusieurs gigaoctets. Sans traitement, le projet
// neuf lit et migre la base de l'ancien.
//
// Deux natures, deux traitements — distinction issue de l'audit du 2026-08-05,
// qui a montré qu'une copie vers un dossier de **même nom** n'était pas nettoyée :
//
//   - caches et instances éphémères : toujours supprimés, ils se régénèrent ;
//   - fichiers d'environnement : ils peuvent contenir de vraies clés. Un
//     changement de nom prouve qu'ils appartiennent à un autre projet, on les
//     régénère. À nom égal, on ne devine pas : on refuse et on explique.

const workspaces = ["apps", "packages"].flatMap((group) => {
  const base = join(root, group);

  if (!existsSync(base)) {
    return [];
  }

  return readdirSync(base).map((entry) => join(group, entry));
});

const EPHEMERAL = [".clerk", ".turbo", ".next", ".react-email"];

const ephemeralPaths = [
  ...EPHEMERAL,
  // Les caches par workspace survivaient à toutes les réinitialisations.
  ...workspaces.flatMap((workspace) =>
    EPHEMERAL.map((entry) => join(workspace, entry))
  ),
].filter((path) => existsSync(join(root, path)));

const inheritedEnv = workspaces
  .map((workspace) => join(workspace, ".env.local"))
  .filter((path) => existsSync(join(root, path)));

const renamed = previousName !== name;
const regenerateEnv = renamed || args.fresh;

// Refus explicite plutôt qu'héritage silencieux ou suppression de vraies clés.
if (
  !(regenerateEnv || args.keepEnv || args.dryRun) &&
  inheritedEnv.length > 0
) {
  fail(
    `Le nom du projet est déjà « ${name} », et ${inheritedEnv.length} fichier(s) d'environnement existent.\n` +
      "    Impossible de savoir s'ils appartiennent à ce projet ou à celui qui a été copié.\n\n" +
      "      --fresh      les supprimer et les régénérer depuis les .env.example\n" +
      "      --keep-env   les conserver tels quels, en connaissance de cause\n\n" +
      "    Un environnement hérité fait pointer le projet neuf sur la base de données\n" +
      "    du projet source, avec ses clés. Voir docs/RISKS.md R-017."
  );
}

if (!args.dryRun) {
  for (const path of ephemeralPaths) {
    rmSync(join(root, path), { recursive: true, force: true });
  }

  if (regenerateEnv) {
    for (const path of inheritedEnv) {
      rmSync(join(root, path), { force: true });
    }
  }
}

if (ephemeralPaths.length > 0) {
  actions.push(
    `${ephemeralPaths.length} cache(s) et instance(s) éphémère(s) supprimés`
  );
}

if (regenerateEnv && inheritedEnv.length > 0) {
  actions.push(
    `${inheritedEnv.length} fichier(s) d'environnement du projet « ${previousName} » supprimés puis régénérés`
  );
}

const out = process.stdout;
out.write(
  `\n  ${args.dryRun ? "Simulation" : "Projet réinitialisé"} : ${previousName} → ${name}\n\n`
);
for (const action of actions) {
  out.write(`    ${args.dryRun ? "modifierait" : "écrit"}  ${action}\n`);
}

// 6. Fichiers .env.local : générés depuis les .env.example, jamais écrasés.
if (!args.dryRun) {
  const setupEnv = join(root, "scripts/setup-env.mjs");
  if (existsSync(setupEnv)) {
    out.write("\n  Fichiers d'environnement :\n");
    execFileSync(process.execPath, [setupEnv], { cwd: root, stdio: "inherit" });
  }
}

out.write(`
  Étapes restantes — celles qui demandent une décision, pas une commande :

    1. Historique Git. Repartir de zéro si la copie ne doit rien hériter :
         rm -rf .git && git init && git add -A && git commit -m "chore: initialisation"
       Puis le dépôt distant :
         gh repo create ${name} --private --source=. --remote=origin --push

    2. pnpm install
       (active les hooks Git au passage, via le script \`prepare\`)

    3. docker compose up -d
       Port ${port} : vérifier qu'il est libre — lsof -nP -iTCP:${port} -sTCP:LISTEN

    4. pnpm verify

    5. Clés de service, au fur et à mesure : décommenter les variables voulues
       dans les .env.local. Sans clé Clerk, l'application démarre mais les pages
       d'authentification ne s'affichent pas. Voir docs/DEPLOYMENT.md.

    6. Décisions de fond, à ne pas repousser :
         - quelles intégrations supprimer (services câblés mais inertes, R-009) ;
         - remplacer le stub Prisma \`Page\` par le vrai modèle ;
         - remplir docs/PROJECT_CONTEXT.md et docs/DOMAIN_MODEL.md sans inventer ;
         - relire ARCHITECTURE, SECURITY_MODEL, QUALITY_GATES et DEPLOYMENT :
           ils décrivent le squelette, pas encore votre produit.

`);
