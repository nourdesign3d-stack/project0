#!/usr/bin/env node
/**
 * Hook PreToolUse — refuse les commandes Bash dangereuses.
 *
 * Pourquoi un hook et pas seulement `permissions.deny` : la liste `deny` compare
 * des préfixes de commande, et ses motifs de lecture ne visent que l'outil Read.
 * Une lecture de secret par `cat` ou une suppression par `find -delete` lui
 * échappent. Le hook inspecte la ligne de commande entière.
 *
 * ── Ce que ce hook est ──
 * Un garde-fou déterministe contre l'erreur et le contournement accidentel.
 *
 * ── Ce qu'il n'est PAS ──
 * Une frontière de sécurité. Une commande suffisamment obscurcie passera :
 * encodage base64, variable construite morceau par morceau, script tiers,
 * interpréteur exotique. La vraie protection reste de ne jamais placer de secret
 * de production sur un poste de développement. Voir docs/SECURITY_MODEL.md.
 *
 * ── Comment il décide ──
 * La ligne est découpée en segments (`|`, `;`, `&&`, `||`). Pour chacun :
 *
 *   1. `sh -c '…'` / `bash -c '…'` : le contenu est réinjecté et analysé à son
 *      tour. Sans cela, une seule paire de guillemets rendait le hook aveugle.
 *   2. Les guillemets sont retirés **en gardant leur contenu**. Une version
 *      antérieure effaçait le contenu pour ignorer la prose : `cat ".env.local"`
 *      passait alors sans être vu. Correction issue d'un audit externe.
 *   3. Secrets : le chemin ne déclenche un refus que si le **premier mot** du
 *      segment est une commande qui lit ou copie un fichier, s'il y a une
 *      redirection d'entrée, ou s'il s'agit d'une affectation de variable.
 *      C'est ce qui distingue `cat .env.local` d'un message de commit qui en parle.
 *   4. Destruction : le motif doit correspondre **au premier mot** du segment,
 *      pas apparaître n'importe où. C'est ce qui laisse passer la prose sans
 *      avoir à effacer le contenu des guillemets.
 *
 * Contrat : JSON du hook sur stdin ; sortie 2 + message sur stderr = refus ;
 * sortie 0 = laisser passer.
 */

import { isAbsolute, resolve } from "node:path";

const SECRET_PATHS = [
  // Fichiers d'environnement réels — .env.example est explicitement toléré.
  // Fin de nom : tout ce qui n'est pas un caractère de nom de fichier. Une liste
  // fermée de séparateurs laissait passer `readFileSync(".env.local",…)` (virgule).
  /(^|[\s=/(])\.env(\.local|\.production|\.development|\.test)?(?![\w.-])/,
  /\.env\.[a-z]+\.local/,
  /\.ssh\//,
  /\.aws\/(credentials|config)/,
  /id_rsa/,
  /\.pem(?![\w.-])/,
  /\.p12(?![\w.-])/,
  /\.keystore/,
];

/**
 * Commandes qui ouvrent, lisent ou recopient un fichier. Comparées au **premier
 * mot** du segment : `git commit -m "… cat .env.local …"` n'est pas une lecture.
 */
const READERS = new Set([
  "awk",
  "base64",
  "bat",
  "cat",
  "code",
  "cp",
  "cut",
  "dd",
  "diff",
  "dotenv",
  "egrep",
  "fgrep",
  "grep",
  "gzip",
  "head",
  "jq",
  "less",
  "ln",
  "more",
  "mv",
  "nl",
  "node",
  "od",
  "open",
  "paste",
  "pbcopy",
  "perl",
  "python",
  "python3",
  "rg",
  "rsync",
  "ruby",
  "scp",
  "sed",
  "sort",
  "source",
  "strings",
  "tail",
  "tar",
  "tee",
  "tr",
  "uniq",
  "xargs",
  "xxd",
  "yq",
  "zip",
]);

/**
 * Chaque règle nomme la commande attendue en tête de segment. Sans cet ancrage,
 * le simple fait d'écrire « rm -rf » dans un message de commit déclenchait un refus.
 */
const DESTRUCTIVE = [
  {
    commands: ["rm"],
    pattern: /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+/,
    why: "suppression récursive ou forcée",
  },
  {
    commands: ["find"],
    pattern: /\s-delete\b/,
    why: "suppression de masse via find",
  },
  {
    commands: ["find"],
    pattern: /-exec\s+rm\b/,
    why: "suppression de masse via find -exec",
  },
  {
    commands: ["git"],
    pattern: /\breset\s+--hard\b/,
    why: "perte du travail non sauvegardé",
  },
  {
    commands: ["git"],
    pattern: /\bclean\s+-[a-zA-Z]*[dfx]/,
    why: "suppression de fichiers non suivis",
  },
  {
    commands: ["git"],
    pattern: /\bpush\b[^|;]*(--force(?!-with-lease)|\s-f\b)/,
    why: "réécriture de l'historique distant",
  },
  {
    commands: ["git"],
    pattern: /\bbranch\s+-D\b/,
    why: "suppression de branche non fusionnée",
  },
  {
    commands: ["prisma"],
    pattern: /\bmigrate\s+reset\b/,
    why: "destruction de la base",
  },
  {
    commands: ["prisma"],
    pattern: /\bdb\s+push\b/,
    why: "modification de schéma hors migration versionnée",
  },
  {
    commands: ["docker"],
    pattern: /\bdown\b[^|;]*(\s-v\b|--volumes)/,
    why: "destruction du volume de données",
  },
  {
    commands: ["docker"],
    pattern: /\bvolume\s+rm\b/,
    why: "destruction d'un volume",
  },
  {
    commands: ["docker"],
    pattern: /\bsystem\s+prune\b/,
    why: "nettoyage destructif global",
  },
  { commands: ["mkfs"], pattern: /./, why: "formatage de système de fichiers" },
  { commands: ["dd"], pattern: /\bif=/, why: "écriture disque de bas niveau" },
  {
    commands: ["chmod"],
    pattern: /-R\s+777\b/,
    why: "permissions dangereuses",
  },
  {
    commands: ["vercel"],
    pattern: /\b(deploy|--prod|env\s+(add|rm))\b/,
    why: "action sur un environnement déployé",
  },
  {
    commands: ["env", "printenv"],
    pattern: /^(env|printenv)\s*$/,
    why: "affichage de l'environnement complet",
  },
];

// `pnpm db:push` et consorts : la commande destructive est le nom du script.
const SCRIPT_ALIASES = [
  {
    pattern: /\bdb:push\b/,
    why: "modification de schéma hors migration versionnée",
  },
];

const PIPE_TO_SHELL = /\b(curl|wget)\b[^|;]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/;
const NESTED_SHELL = /^(?:sudo\s+)?(?:sh|bash|zsh|dash)\s+-c\s+(.+)$/s;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const INPUT_REDIRECT = /(^|\s)<\s*\S/;
const WRAPPER =
  /^(sudo|pnpm|npm|npx|yarn|bun|bunx|time|nice)\s+(exec\s+|run\s+|dlx\s+|-{1,2}\S+\s+)*/;
const WHITESPACE = /\s+/;
const QUOTES = /['"`]/g;
const TEMPORARY = /^(\/private)?\/(tmp|var\/folders)\//;

const say = (text) => process.stderr.write(text);

const deny = (reason, detail) => {
  say(
    "\n  ✗ Commande refusée par .claude/hooks/guard-bash.mjs\n" +
      `    Motif : ${reason}\n` +
      `    ${detail}\n\n` +
      "    Si l'action est réellement voulue, c'est à l'humain de la lancer.\n\n"
  );
  process.exit(2);
};

/** Retire les guillemets en conservant ce qu'ils entourent. */
const unquote = (text) => text.replace(QUOTES, "");

/** Premier mot réel du segment, une fois les enrobages retirés. */
const commandOf = (segment) => {
  let text = unquote(segment).trim();
  let previous;

  do {
    previous = text;
    text = text.replace(WRAPPER, "");
  } while (text !== previous);

  return text.split(WHITESPACE)[0] ?? "";
};

/**
 * Vrai si tous les chemins absolus du segment sont dans un dossier temporaire.
 * Les chemins sont normalisés : `/tmp/../Users/…` sort du bac à sable et ne doit
 * donc pas bénéficier de la tolérance (contournement relevé en audit).
 */
const onlyTemporaryPaths = (segment) => {
  const operands = unquote(segment)
    .split(WHITESPACE)
    .filter((token) => isAbsolute(token));

  return (
    operands.length > 0 &&
    operands.every((path) => TEMPORARY.test(resolve(path)))
  );
};

const SEGMENT_SEPARATOR = /\|\||&&|[|;&\n]/;

/** Refuse si le segment lit un chemin sensible. */
const checkSecrets = (segment, head) => {
  const bare = unquote(segment);
  const probe = bare.replaceAll(".env.example", "«example»");

  const touchesFile =
    READERS.has(head) || INPUT_REDIRECT.test(bare) || ASSIGNMENT.test(bare);

  if (touchesFile && SECRET_PATHS.some((pattern) => pattern.test(probe))) {
    deny(
      "lecture ou copie d'un fichier de secrets",
      "Clés et identifiants ne se lisent pas depuis un agent."
    );
  }
};

/** Refuse si le segment est une commande destructive hors bac à sable. */
const checkDestructive = (segment, head) => {
  if (onlyTemporaryPaths(segment)) {
    return;
  }

  const bare = unquote(segment);

  for (const { commands, pattern, why } of DESTRUCTIVE) {
    if (commands.includes(head) && pattern.test(bare)) {
      deny(
        `commande destructive — ${why}`,
        `Commande : ${segment.slice(0, 120)}`
      );
    }
  }

  for (const { pattern, why } of SCRIPT_ALIASES) {
    if (pattern.test(bare)) {
      deny(
        `commande destructive — ${why}`,
        `Commande : ${segment.slice(0, 120)}`
      );
    }
  }
};

const inspect = (command, depth = 0) => {
  if (depth > 3) {
    return;
  }

  if (PIPE_TO_SHELL.test(unquote(command))) {
    deny("exécution de code téléchargé", `Commande : ${command.slice(0, 120)}`);
  }

  for (const rawSegment of command.split(SEGMENT_SEPARATOR)) {
    const segment = rawSegment.trim();

    if (!segment) {
      continue;
    }

    // `sh -c '…'` : analyser ce qui est réellement exécuté.
    const nested = unquote(segment).match(NESTED_SHELL);

    if (nested) {
      inspect(nested[1], depth + 1);
      continue;
    }

    const head = commandOf(segment);

    checkSecrets(segment, head);
    checkDestructive(segment, head);
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
  // Un hook illisible ne doit pas bloquer le travail : on laisse passer et on le dit.
  say("  guard-bash : entrée illisible, commande non inspectée.\n");
}

process.exit(0);
