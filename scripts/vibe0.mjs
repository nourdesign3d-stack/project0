#!/usr/bin/env node
/**
 * vibe0 — amorçage interactif d'un projet à partir de ce squelette.
 *
 *   pnpm vibe0
 *
 * Enchaîne la plomberie : nom, port libre, remise à zéro du journal, fichiers
 * d'environnement, clés de service, dépendances, base de données, vérification.
 *
 * Deux règles de conception :
 *
 *   1. **Les secrets ne quittent pas votre machine.** Les clés sont saisies en
 *      mode masqué, écrites directement dans les .env.local (permissions 600),
 *      jamais affichées, jamais journalisées, jamais transmises à un agent.
 *      C'est la raison d'être de ce script : un assistant n'a pas à manipuler
 *      vos identifiants.
 *
 *   2. **Aucune action irréversible sans réponse explicite.** Réinitialiser
 *      l'historique Git ou créer un dépôt distant sont proposés, jamais
 *      supposés. La valeur par défaut est toujours la plus prudente.
 *
 * Ce que le script ne fait pas : décider du périmètre produit, choisir les
 * intégrations à supprimer, écrire le modèle de domaine. Ce sont des décisions ;
 * elles sont listées à la fin.
 */

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,48}$/;
const CLERK_SECRET = /^sk_/;
const YES = /^(o|oui|y|yes)$/i;
const CLERK_PUBLISHABLE = /^pk_/;
const COMMENTED_KEY = (key) => new RegExp(`^#\\s*${key}=.*$`, "m");
const ACTIVE_KEY = (key) => new RegExp(`^${key}=.*$`, "m");

// Échecs rencontrés : le script ne doit pas annoncer un succès qu'il n'a pas.
const problems = [];

const out = process.stdout;
const say = (text = "") => out.write(`${text}\n`);

if (!process.stdin.isTTY) {
  process.stderr.write(
    "\n  vibe0 est interactif : le lancer depuis un terminal.\n" +
      "  Pour un usage non interactif : pnpm project:init --name <slug> --port <n>\n\n"
  );
  process.exit(1);
}

// Sortie que l'on peut rendre muette le temps d'une saisie de secret.
// Une seule interface readline pour tout le script : mélanger readline et une
// lecture manuelle en mode brut sur le même stdin coupe les questions suivantes.
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!output.muted) {
      process.stdout.write(chunk, encoding);
    }
    callback();
  },
});
output.muted = false;

const rl = createInterface({
  input: process.stdin,
  output,
  terminal: true,
});

// Entrée fermée (Ctrl+D, redirection épuisée) : sortir proprement plutôt que
// de laisser une promesse en suspens et un avertissement Node illisible.
// `finished` distingue une interruption de la fermeture normale en fin de script.
let finished = false;

rl.on("close", () => {
  if (!finished) {
    say("\n  Interrompu : entrée fermée. Rien de plus n'a été modifié.");
    process.exit(130);
  }
});

const ask = (question, fallback = "") =>
  new Promise((resolve) => {
    const suffix = fallback ? ` [${fallback}]` : "";
    rl.question(`  ${question}${suffix} : `, (answer) =>
      resolve(answer.trim() || fallback)
    );
  });

const confirm = async (question, defaultYes = false) => {
  const answer = await ask(`${question} ${defaultYes ? "(O/n)" : "(o/N)"}`, "");
  if (!answer) {
    return defaultYes;
  }
  return YES.test(answer);
};

/**
 * Saisie masquée : la question s'affiche, la frappe non.
 * L'écho est coupé en rendant muette la sortie de readline, plutôt qu'en lisant
 * stdin à la main en mode brut — mélanger les deux mettait stdin en pause et
 * laissait les questions suivantes sans réponse (promesse jamais résolue,
 * avertissement « unsettled top-level await », exit 13).
 */
const askSecret = (question) =>
  new Promise((resolve) => {
    rl.question(
      `  ${question} (saisie masquée, Entrée pour passer) : `,
      (answer) => {
        output.muted = false;
        process.stdout.write("\n");
        resolve(answer.trim());
      }
    );

    output.muted = true;
  });

// readline garde le terminal en mode brut : on le met en pause le temps qu'un
// processus enfant occupe stdin, sinon sa sortie et ses invites se mélangent.
const run = (command, args, options = {}) => {
  rl.pause();
  try {
    return execFileSync(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    });
  } finally {
    rl.resume();
  }
};

/** Sortie capturée, sans affichage : pour interroger `gh` sans polluer l'écran. */
const capture = (command, args) => {
  rl.pause();
  try {
    return execFileSync(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } finally {
    rl.resume();
  }
};

/**
 * `docker compose up -d` rend la main avant que Postgres accepte une connexion.
 * Migrer aussitôt échouerait sur une base pourtant en cours de démarrage.
 */
const waitForDatabase = async (attempts = 30) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      capture("docker", [
        "compose",
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "postgres",
      ]);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return false;
};

const owner = () => {
  try {
    return capture("gh", ["api", "user", "--jq", ".login"]);
  } catch {
    return "";
  }
};

const repoExists = (repository) => {
  try {
    capture("gh", ["repo", "view", repository, "--json", "name"]);
    return true;
  } catch {
    return false;
  }
};

const canBind = (host, port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });

// Un port n'est utilisable que s'il est libre sur les deux adresses : Docker
// publie sur 0.0.0.0 par défaut, alors que d'autres projets peuvent n'occuper
// que 127.0.0.1 (ou l'inverse). Ne sonder que la boucle locale faisait passer
// pour libres des ports déjà pris par un conteneur voisin.
const isPortFree = async (port) =>
  (await canBind("127.0.0.1", port)) && (await canBind("0.0.0.0", port));

const findFreePort = async (start) => {
  for (let port = start; port < start + 20; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  return start;
};

/** Écrit une clé dans un .env.local sans jamais afficher sa valeur. */
const setSecret = (workspace, key, value) => {
  const path = join(root, workspace, ".env.local");

  if (!existsSync(path)) {
    return false;
  }

  const line = `${key}="${value}"`;
  let content = readFileSync(path, "utf8");

  if (ACTIVE_KEY(key).test(content)) {
    content = content.replace(ACTIVE_KEY(key), line);
  } else if (COMMENTED_KEY(key).test(content)) {
    content = content.replace(COMMENTED_KEY(key), line);
  } else {
    content += `\n${line}\n`;
  }

  writeFileSync(path, content);
  chmodSync(path, 0o600);
  return true;
};

const workspacesWith = (key) => {
  const found = [];
  for (const group of ["apps", "packages"]) {
    const base = join(root, group);
    if (!existsSync(base)) {
      continue;
    }
    for (const entry of readdirSync(base)) {
      const example = join(base, entry, ".env.example");
      if (existsSync(example) && readFileSync(example, "utf8").includes(key)) {
        found.push(join(group, entry));
      }
    }
  }
  return found;
};

// ---------------------------------------------------------------------------

say("");
say("  vibe0 — amorçage d'un projet");
say("  ─────────────────────────────");
say("  Entrée pour accepter la valeur par défaut. Ctrl+C pour interrompre.");
say("");

// 1. Identité
const suggestedName = basename(root)
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-");
let name = await ask("Nom du projet (minuscules, tirets)", suggestedName);

while (!NAME_PATTERN.test(name)) {
  say("    → minuscules, chiffres et tirets, commençant par une lettre.");
  name = await ask("Nom du projet", suggestedName);
}

// 2. Port
const suggested = await findFreePort(5432);
if (suggested !== 5432) {
  say(`    5432 est occupé ; ${suggested} est libre.`);
}
const port = await ask("Port Postgres local", String(suggested));

// 3. Journal documentaire
say("");
const resetDocs = await confirm(
  "Remettre à zéro le journal documentaire (contexte, domaine, risques, décisions) ?",
  true
);

say("");
say("  Application…");

try {
  run(process.execPath, [
    "scripts/project-init.mjs",
    "--name",
    name,
    "--port",
    String(port),
    ...(resetDocs ? [] : ["--keep-docs"]),
  ]);
} catch {
  // Cas typique : relance dans un projet déjà amorcé sous le même nom.
  // project-init a déjà affiché un message clair — ne pas l'enterrer sous une
  // trace Node, et proposer la suite au lieu de renvoyer l'utilisateur au shell.
  say("");

  if (
    await confirm(
      "Régénérer quand même les fichiers d'environnement (--fresh) ? Les clés saisies précédemment seront perdues",
      false
    )
  ) {
    run(process.execPath, [
      "scripts/project-init.mjs",
      "--name",
      name,
      "--port",
      String(port),
      "--fresh",
      ...(resetDocs ? [] : ["--keep-docs"]),
    ]);
  } else {
    say("  Amorçage interrompu : rien n'a été modifié de plus.");
    finished = true;
    rl.close();
    process.exit(1);
  }
}

// 4. Clés de service — saisie masquée, écriture directe.
say("  Clés de service");
say("  ───────────────");
say("  Saisies en masqué et écrites dans les .env.local (chmod 600).");
say("  Elles ne sont ni affichées, ni journalisées, ni transmises à un agent.");
say("  Entrée pour passer : l'application démarre sans, seules les pages");
say("  d'authentification resteront indisponibles.");
say("");

const secrets = [
  {
    key: "CLERK_SECRET_KEY",
    label: "Clerk — clé secrète (sk_…)",
    pattern: CLERK_SECRET,
  },
  {
    key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    label: "Clerk — clé publique (pk_…)",
    pattern: CLERK_PUBLISHABLE,
  },
];

for (const secret of secrets) {
  const value = await askSecret(secret.label);

  if (!value) {
    continue;
  }

  if (!secret.pattern.test(value)) {
    say(
      `    → format inattendu pour ${secret.key} : ignorée, à renseigner à la main.`
    );
    continue;
  }

  const targets = workspacesWith(secret.key).filter((workspace) =>
    setSecret(workspace, secret.key, value)
  );
  say(`    ${secret.key} → ${targets.length} fichier(s) mis à jour`);
}

// 5. Plomberie
say("");
if (await confirm("Installer les dépendances (pnpm install) ?", true)) {
  try {
    run("pnpm", ["install"]);
  } catch {
    say("    → installation échouée.");
    problems.push("pnpm install a échoué");
  }
}

let databaseUp = false;

if (
  await confirm(
    `Démarrer Postgres sur le port ${port} (docker compose up -d) ?`,
    true
  )
) {
  try {
    run("docker", ["compose", "up", "-d"]);
    databaseUp = true;
  } catch {
    // Deux causes fréquentes, et rien ne permet de trancher ici :
    // Docker éteint, ou port déjà publié par un conteneur d'un autre projet.
    say("    → la base n'a pas démarré.");
    say(`       Port occupé ? lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    say("       Changer POSTGRES_PORT dans .env, puis mettre à jour");
    say("       DATABASE_URL dans les .env.local, et relancer :");
    say("       docker compose up -d");
    problems.push("la base de données n'a pas démarré");
  }
}

// Une base fraîche est vide : sans cette étape, le premier utilisateur qui
// franchit l'authentification tombe sur une erreur serveur, la page d'accueil
// authentifiée interrogeant `Page`. Constaté en exécutant le parcours pour de
// vrai le 2026-08-05 — invisible tant que personne ne passait `/sign-in`.
// `migrate dev` applique la migration initiale versionnée ; il n'en crée une
// nouvelle que si le schéma a déjà été modifié.
if (
  databaseUp &&
  (await confirm("Appliquer le schéma à la base (pnpm migrate) ?", true))
) {
  const ready = await waitForDatabase();

  if (ready) {
    try {
      run("pnpm", ["migrate", "--name", "init"]);
    } catch {
      say("    → migration échouée. Reprendre avec : pnpm migrate --name init");
      problems.push("le schéma n'a pas été appliqué");
    }
  } else {
    say("    → la base n'accepte pas encore de connexion.");
    say("       Reprendre avec : pnpm migrate --name init");
    problems.push("le schéma n'a pas été appliqué");
  }
}

if (
  await confirm(
    "Lancer la vérification complète (lint, typecheck, tests, build) ?",
    true
  )
) {
  try {
    run("pnpm", ["verify"]);
  } catch {
    say("    → la vérification a échoué : corriger avant d'aller plus loin.");
    problems.push("pnpm verify a échoué");
  }
}

// 6. Actions irréversibles — jamais par défaut.
say("");
if (
  await confirm("Repartir d'un historique Git vierge (supprime .git) ?", false)
) {
  run("rm", ["-rf", ".git"]);
  run("git", ["init", "-q"]);
  run("git", ["add", "-A"]);
  run("git", ["commit", "-q", "-m", "chore: initialisation du projet"]);
  run("node", ["scripts/install-hooks.mjs"]);
  say("    historique réinitialisé.");

  if (await confirm("Créer le dépôt GitHub privé et pousser ?", false)) {
    let repository = name;

    // Vérifier la disponibilité du nom avant d'appeler `gh repo create` :
    // sinon l'échec remonte sous forme d'erreur GraphQL brute, après que
    // l'historique local a déjà été réinitialisé.
    while (repository && repoExists(repository)) {
      say(`    Le dépôt ${repository} existe déjà sur ce compte.`);

      if (await confirm("Le réutiliser comme remote de ce dossier ?", false)) {
        break;
      }

      repository = await ask("Autre nom (vide pour renoncer)", "");
    }

    if (!repository) {
      say(
        "    → dépôt distant non configuré. `gh repo create` reste possible plus tard."
      );
    } else if (repoExists(repository)) {
      // Dépôt existant : on se contente d'y rattacher le dossier.
      try {
        run("git", [
          "remote",
          "add",
          "origin",
          `https://github.com/${owner()}/${repository}.git`,
        ]);
        // Ne pas supposer `main` : sans `init.defaultBranch`, git crée `master`.
        const branch = capture("git", ["branch", "--show-current"]) || "main";
        run("git", ["push", "-u", "origin", branch]);
      } catch {
        say("    → rattachement ou push refusé (dépôt non vide ?).");
        say("       Vérifier :  git remote -v  puis  git push -u origin main");
      }
    } else {
      try {
        run("gh", [
          "repo",
          "create",
          repository,
          "--private",
          "--source=.",
          "--remote=origin",
          "--push",
        ]);
      } catch {
        // Le dépôt distant peut avoir été créé alors que seul le push a échoué :
        // ne pas préjuger de la cause, donner la commande qui reprend la main.
        say("    → le dépôt a pu être créé sans que le push aboutisse.");
        say("       Vérifier :  git remote -v  et  gh auth status");
        say("       Reprendre :  git push -u origin main");
      }
    }
  }
}

finished = true;
rl.close();

if (problems.length > 0) {
  say("");
  say("  ─────────────────────────────────────────────────────────────────");
  say(`  ${name} est amorcé PARTIELLEMENT. Étapes en échec :`);
  say("");
  for (const problem of problems) {
    say(`    ✗ ${problem}`);
  }
  say("");
  say("  Corriger avant de continuer : un projet qui ne vérifie pas ne se");
  say("  développe pas. Reprendre avec : pnpm verify");
  say("  ─────────────────────────────────────────────────────────────────");
  say("");
  process.exit(1);
}

say(`
  ─────────────────────────────────────────────────────────────────
  ${name} est amorcé.

  Ce qui reste relève de décisions, pas de commandes :

    1. Quelles intégrations supprimer ? Une quinzaine de services sont
       câblés et inertes ; chacun gardé est une surface d'attaque et un
       coût. (risque R-007)

    2. Remplacer le stub Prisma \`Page\` par le premier vrai modèle,
       puis : pnpm migrate --name <nom>

    3. Remplir docs/PROJECT_CONTEXT.md et docs/DOMAIN_MODEL.md —
       sans rien inventer. Une supposition va dans ASSUMPTIONS.md.

    4. Relire docs/ARCHITECTURE.md, SECURITY_MODEL.md, QUALITY_GATES.md
       et DEPLOYMENT.md : ils décrivent le squelette, pas votre produit.

  Démarrer : pnpm dev
  Auditer la conformité en cours de route : /vibe (dans Claude Code)
  ─────────────────────────────────────────────────────────────────
`);
