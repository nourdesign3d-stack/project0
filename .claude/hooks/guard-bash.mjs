#!/usr/bin/env node
/**
 * Hook PreToolUse — refuse les commandes Bash dangereuses.
 *
 * ── Ce que ce hook est ──
 * Un garde-fou déterministe contre l'erreur et le contournement accidentel.
 *
 * ── Ce qu'il n'est PAS ──
 * Une frontière de sécurité. Un obscurcissement déterminé passera : encodage,
 * chaîne construite morceau par morceau, interpréteur tiers, variable résolue à
 * l'exécution. La vraie protection reste de ne jamais placer de secret de
 * production sur un poste de développement. Voir docs/SECURITY_MODEL.md, R-016.
 *
 * ── Comment il décide ──
 * La ligne est **tokenisée** (`lib/shell-tokens.mjs`) plutôt qu'analysée au
 * motif. Trois versions antérieures reposaient sur des expressions régulières
 * appliquées au texte brut ; les trois ont été contournées par un audit externe.
 * Avec la tokenisation :
 *
 *   - un argument entre guillemets est **un seul jeton** : un message de commit
 *     qui parle de `rm -rf` n'est jamais confondu avec la commande ;
 *   - les substitutions `$(…)` et les backticks sont extraits et analysés ;
 *   - les enrobages (`sudo`, `env`, `pnpm exec`, `xargs`…) sont retirés pour
 *     retrouver la commande réelle ;
 *   - `sh -c '…'` est réinjecté et réanalysé ;
 *   - le corps d'un heredoc est traité comme une donnée, pas comme des commandes.
 *
 * Chaque règle nomme la commande à laquelle elle s'applique et inspecte les
 * **arguments**, jamais le texte entier.
 *
 * Contrat : JSON du hook sur stdin ; sortie 2 + message sur stderr = refus ;
 * sortie 0 = laisser passer.
 */

import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parseCommand, resolveInvocation } from "./lib/shell-tokens.mjs";

const SECRET_PATHS = [
  // Toute variante de `.env`, quel qu'en soit le suffixe. Énumérer
  // `local|production|development|test` laissait passer `.env.staging`,
  // `.env.preview` et tout nom non anticipé — relevé en audit le 2026-08-06.
  // `.env.example` est écarté séparément, dans `isSecretPath`.
  /(^|\/)\.env(\.[\w.-]+)?$/,
  /\.ssh\//,
  /\.aws\/(credentials|config)$/,
  /id_rsa/,
  /\.(pem|p12|keystore)$/,
];

/** Commandes qui ouvrent, lisent, recopient ou éditent un fichier. */
const READERS = new Set([
  ".",
  "awk",
  "base64",
  "bat",
  "cat",
  "code",
  "cp",
  "curl",
  "cut",
  "dd",
  "diff",
  "ditto",
  "dotenv",
  "egrep",
  "emacs",
  "fgrep",
  "git",
  "grep",
  "gzip",
  "head",
  "hexdump",
  "jq",
  "less",
  "ln",
  "md5",
  "md5sum",
  "more",
  "mv",
  "nano",
  "nl",
  "node",
  "od",
  "open",
  "openssl",
  "paste",
  "pbcopy",
  "perl",
  "plutil",
  "python",
  "python3",
  "rev",
  "rg",
  "rsync",
  "ruby",
  "scp",
  "sed",
  "sha1sum",
  "sha256sum",
  "shasum",
  "sort",
  "source",
  "split",
  "strings",
  "tail",
  "tar",
  "tee",
  "tr",
  "uniq",
  "uuencode",
  "vi",
  "vim",
  "xxd",
  "yq",
  "zip",
]);

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);

const INTERPRETERS = new Set(["node", "python", "python3", "perl", "ruby"]);

// Version non ancrée des chemins sensibles, pour chercher DANS un script
// passé à un interpréteur. `.env.example` reste toléré.
const SECRET_MENTION =
  /\.env(\.local|\.production|\.development|\.test)?(?![\w.-])|\.ssh\/|id_rsa|\.aws\/(credentials|config)|\.(pem|p12|keystore)(?![\w.-])/;

const CONTAINS_WHITESPACE = /\s/;

/**
 * Un jeton compte-t-il comme un argument de commande ?
 *
 * ⚠️ La version précédente écartait **tout** jeton entre guillemets, pour éviter
 * qu'un message de commit parlant de `rm -rf` ne déclenche une règle. Effet de
 * bord découvert en audit le 2026-08-06 : `rm "-rf" /chemin`, `git "push"
 * "--force"` et `docker compose down "-v"` passaient tous. Des guillemets
 * suffisaient à désarmer l'intégralité des règles.
 *
 * Le bon critère n'est pas la présence de guillemets mais **l'espacement** : un
 * argument réel — un drapeau, une sous-commande — ne contient pas d'espace,
 * alors qu'une phrase en contient toujours. `"-rf"` compte ; `"docs: git push
 * --force"` reste un seul jeton porteur d'espaces, donc du texte.
 */
const significant = (token) =>
  !(token.quoted && CONTAINS_WHITESPACE.test(token.value));

/** `has(args, …)` : le mot figure-t-il parmi les arguments réels ? */
const has = (args, ...words) =>
  args.some((token) => significant(token) && words.includes(token.value));

const startsWith = (args, word) =>
  args.some(
    (token, index) =>
      significant(token) &&
      token.value === word &&
      args.slice(0, index).every((previous) => previous.value.startsWith("-"))
  );

const hasFlag = (args, test) =>
  args.some((token) => significant(token) && test(token.value));

/**
 * Règles destructives. `check(args)` ne regarde que les arguments : le contenu
 * d'un message ou d'un fichier ne peut pas les déclencher.
 *
 * `sandboxable` marque les seules règles dont l'objet **est** un chemin de
 * fichier : elles acceptent l'exemption du bac à sable temporaire. Les autres ne
 * la reçoivent jamais — `git push --force`, `prisma db push`, `docker system
 * prune` ou `vercel` ne détruisent rien qui vive dans un dossier, et rien dans
 * leur ligne de commande n'est un chemin. Les exempter parce que le dossier
 * courant est temporaire n'avait aucun sens ; c'était pourtant le cas jusqu'au
 * 2026-08-07, où un audit a montré qu'un dépôt cloné sous /tmp désarmait les 26
 * règles d'un coup.
 */
const DESTRUCTIVE = [
  {
    command: "rm",
    check: (args) => hasFlag(args, (v) => RECURSIVE_RM.test(v)),
    why: "suppression récursive ou forcée",
    sandboxable: true,
  },
  {
    command: "find",
    check: (args) => has(args, "-delete") || has(args, "-exec", "-execdir"),
    why: "suppression de masse via find",
    sandboxable: true,
  },
  {
    command: "git",
    check: (args) => has(args, "reset") && has(args, "--hard"),
    why: "perte du travail non sauvegardé",
  },
  {
    command: "git",
    check: (args) =>
      startsWith(args, "clean") &&
      hasFlag(args, (v) => GIT_CLEAN_FLAGS.test(v)),
    why: "suppression de fichiers non suivis",
  },
  {
    command: "git",
    check: (args) =>
      has(args, "push") && hasFlag(args, (v) => v === "--force" || v === "-f"),
    why: "réécriture de l'historique distant",
  },
  {
    command: "git",
    check: (args) => has(args, "branch") && has(args, "-D"),
    why: "suppression de branche non fusionnée",
  },
  {
    command: "prisma",
    check: (args) => has(args, "migrate") && has(args, "reset"),
    why: "destruction de la base",
  },
  {
    command: "prisma",
    check: (args) => has(args, "db") && has(args, "push"),
    why: "modification de schéma hors migration versionnée",
  },
  {
    command: "docker",
    check: (args) =>
      has(args, "down") &&
      hasFlag(args, (v) => v === "-v" || v === "--volumes"),
    why: "destruction du volume de données",
  },
  {
    command: "docker",
    check: (args) => has(args, "volume") && has(args, "rm", "prune"),
    why: "destruction d'un volume",
  },
  {
    command: "docker",
    check: (args) => has(args, "system") && has(args, "prune"),
    why: "nettoyage destructif global",
  },
  {
    command: "mkfs",
    check: () => true,
    why: "formatage de système de fichiers",
  },
  {
    // Effacement irrécupérable : aucune corbeille, aucune restauration.
    command: "shred",
    check: () => true,
    why: "effacement irréversible du contenu d'un fichier",
    sandboxable: true,
  },
  {
    command: "truncate",
    check: (args) => hasFlag(args, (value) => value.startsWith("-s")),
    why: "vidage d'un fichier",
    sandboxable: true,
  },
  {
    command: "dd",
    check: (args) => hasFlag(args, (v) => v.startsWith("if=")),
    why: "écriture disque de bas niveau",
  },
  {
    command: "chmod",
    check: (args) => has(args, "-R") && has(args, "777"),
    why: "permissions dangereuses",
  },
  {
    // Liste blanche : seules les commandes de consultation inoffensives passent.
    // `vercel env pull` écrit les variables de production sur le disque.
    command: "vercel",
    check: (args) =>
      !args.every((token) =>
        ["--help", "-h", "--version", "-v", "whoami"].includes(token.value)
      ),
    why: "action sur un environnement déployé ou récupération de ses variables",
  },
  {
    command: "printenv",
    check: () => true,
    why: "affichage de variables d'environnement",
  },
  {
    command: "env",
    check: (args) => args.length === 0,
    why: "affichage de l'environnement complet",
  },
];

/** Scripts du dépôt dont le nom seul suffit à identifier l'action. */
const SCRIPT_ALIASES = new Map([
  ["db:push", "modification de schéma hors migration versionnée"],
]);

const TEMPORARY = /^(\/private)?\/(tmp|var\/folders)\//;
const RECURSIVE_RM = /^-[a-zA-Z]*[rRf]/;
const GIT_CLEAN_FLAGS = /^-[a-zA-Z]*[dfx]/;
const TILDE = /^~\//;
const SHELL_EVAL_FLAG = /^-[a-z]*c$/;
const INTERPRETER_EVAL_FLAG = /^-[a-zA-Z]*[epE]/;

const deny = (reason, detail) => {
  process.stderr.write(
    "\n  ✗ Commande refusée par .claude/hooks/guard-bash.mjs\n" +
      `    Motif : ${reason}\n` +
      `    ${detail}\n\n` +
      "    Si l'action est réellement voulue, c'est à l'humain de la lancer.\n\n"
  );
  process.exit(2);
};

const isSecretPath = (value) => {
  const candidate = value.replace(TILDE, "");

  if (candidate.endsWith(".env.example")) {
    return false;
  }

  return SECRET_PATHS.some((pattern) => pattern.test(candidate));
};

/**
 * Tous les chemins visés sont-ils dans un dossier temporaire ?
 *
 * ⚠️ Deux défauts corrigés, dans cet ordre :
 *
 * 1. La version d'origine ne retenait que les chemins **absolus**. Dans
 *    `rm -rf /tmp/keep ~/Documents`, `~/Documents` n'étant pas absolu, il ne
 *    restait que `/tmp/keep` : « tout est temporaire », règle sautée.
 *    Corrigé le 2026-08-06 en résolvant **chaque** argument depuis le dossier
 *    courant.
 *
 * 2. Cette correction en a créé une pire. Résoudre depuis le dossier courant
 *    rendait l'exemption **contagieuse** : dès que le dépôt lui-même vivait
 *    sous `/tmp` ou `$TMPDIR` — un clone d'audit, un bac à sable d'agent — tout
 *    argument relatif résolvait en zone temporaire et **la totalité des règles
 *    sautait**. Relevé en audit le 2026-08-07.
 *
 * Un chemin doit désormais être **absolu par lui-même**, après expansion du `~`.
 * Le dossier courant n'entre plus dans la décision : c'est ce qui rend le
 * verdict indépendant de l'endroit où le dépôt est cloné.
 */
const expandHome = (value) =>
  value === "~" || value.startsWith("~/")
    ? join(homedir(), value.slice(1))
    : value;

const onlyTemporaryPaths = (args) => {
  const paths = args
    .map((token) => token.value)
    .filter((value) => !value.startsWith("-"))
    .map(expandHome);

  return (
    paths.length > 0 &&
    // `isAbsolute` avant `resolve` : sans ce filtre, `resolve("docs")` emprunte
    // le dossier courant et un dépôt cloné sous /tmp désarme le garde-fou.
    paths.every((path) => isAbsolute(path) && TEMPORARY.test(resolve(path)))
  );
};

/** Refuse toute lecture, directe ou via interpréteur, d'un chemin sensible. */
const checkSecrets = (command, args, assignments) => {
  const values = [...assignments, ...args].map((token) => token.value);

  if (
    (READERS.has(command) || command === "") &&
    values.some((value) => isSecretPath(value))
  ) {
    deny(
      "lecture ou copie d'un fichier de secrets",
      "Clés et identifiants ne se lisent pas depuis un agent."
    );
  }

  // `node -e '…readFileSync(".env.local")…'` : le chemin sensible est DANS le
  // script passé en argument, pas un argument distinct.
  if (
    INTERPRETERS.has(command) &&
    hasFlag(args, (v) => INTERPRETER_EVAL_FLAG.test(v)) &&
    args.some((token) => token.quoted && SECRET_MENTION.test(token.value))
  ) {
    deny(
      "lecture d'un fichier de secrets via un interpréteur",
      "Clés et identifiants ne se lisent pas depuis un agent."
    );
  }
};

/** Refuse les commandes destructives hors bac à sable temporaire. */
const checkDestructive = (command, args) => {
  if (SCRIPT_ALIASES.has(command)) {
    deny(
      `commande destructive — ${SCRIPT_ALIASES.get(command)}`,
      `Commande : ${command}`
    );
  }

  // L'exemption est calculée une fois, mais n'est offerte qu'aux règles qui
  // portent sur des chemins : elle ne doit pas se propager aux autres.
  const inSandbox = onlyTemporaryPaths(args);

  for (const rule of DESTRUCTIVE) {
    if (rule.sandboxable && inSandbox) {
      continue;
    }

    if (rule.command === command && rule.check(args)) {
      deny(
        `commande destructive — ${rule.why}`,
        `Commande : ${[command, ...args.map((t) => t.value)]
          .join(" ")
          .slice(0, 120)}`
      );
    }
  }
};

const inspect = (input, depth = 0) => {
  if (depth > 4) {
    return;
  }

  const { invocations, subshells } = parseCommand(input);

  for (const nested of subshells) {
    inspect(nested, depth + 1);
  }

  let previous = null;

  for (const tokens of invocations) {
    const { command, args, assignments } = resolveInvocation(tokens);

    // `sh -c '…'` : ce qui est réellement exécuté se trouve dans l'argument.
    if (SHELLS.has(command) && hasFlag(args, (v) => SHELL_EVAL_FLAG.test(v))) {
      const script = args.find(
        (token) => token.quoted || !token.value.startsWith("-")
      );

      if (script) {
        inspect(script.value, depth + 1);
        previous = command;
        continue;
      }
    }

    // Télécharger puis exécuter : la commande précédente est un rapatriement.
    if (SHELLS.has(command) && (previous === "curl" || previous === "wget")) {
      deny("exécution de code téléchargé", `Commande : ${input.slice(0, 120)}`);
    }

    checkSecrets(command, args, assignments);
    checkDestructive(command, args);

    previous = command;
  }
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

try {
  const raw = await readStdin();
  const payload = raw ? JSON.parse(raw) : {};

  if (payload?.tool_name === "Bash") {
    inspect(String(payload?.tool_input?.command ?? ""));
  }
} catch {
  process.stderr.write(
    "  guard-bash : entrée illisible, commande non inspectée.\n"
  );
}

process.exit(0);
