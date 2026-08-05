/**
 * Découpage d'une ligne de commande shell en invocations.
 *
 * Pourquoi un tokeniseur et pas des expressions régulières : trois versions
 * successives du garde-fou ont été écrites à coups de motifs sur le texte brut,
 * et les trois ont été contournées par un audit — guillemets, substitution de
 * commande, enrobage `env`, interpréteur imbriqué. Chaque rustine ouvrait un
 * autre trou, et l'effacement de la prose ouvrait une faille béante.
 *
 * Le principe est inversé : on découpe d'abord, on décide ensuite. Un argument
 * entre guillemets devient **un seul jeton** — un message de commit qui parle de
 * `rm -rf` n'est donc jamais confondu avec la commande, sans avoir à effacer
 * quoi que ce soit.
 *
 * Ce n'est pas un shell : les expansions de variables ne sont pas résolues, et
 * un obscurcissement déterminé (base64, concaténation) passera. Le garde-fou
 * reste un garde-fou, pas une frontière de sécurité.
 */

const OPERATORS = ["&&", "||", "|", ";", "\n", "&"];
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\2\s*$/gm;

/**
 * Découpe une ligne en invocations. Chaque invocation est une liste de jetons
 * `{ value, quoted }`, plus la liste des sous-commandes rencontrées
 * (`$(…)`, backticks) qui seront analysées séparément.
 */
export const parseCommand = (input) => {
  // Le corps d'un heredoc est une donnée, pas une commande.
  const source = input.replace(HEREDOC, " ");

  const invocations = [];
  const subshells = [];

  let tokens = [];
  let current = "";
  let quoted = false;
  let started = false;

  const pushToken = () => {
    if (started) {
      tokens.push({ value: current, quoted });
      current = "";
      quoted = false;
      started = false;
    }
  };

  const pushInvocation = () => {
    pushToken();
    if (tokens.length > 0) {
      invocations.push(tokens);
      tokens = [];
    }
  };

  /** Lit jusqu'au délimiteur fermant en tenant compte de l'imbrication. */
  const readUntil = (text, from, open, close) => {
    let depth = 1;
    let index = from;

    while (index < text.length && depth > 0) {
      if (open && text[index] === open) {
        depth += 1;
      } else if (text[index] === close) {
        depth -= 1;
      }
      index += 1;
    }

    return { content: text.slice(from, index - 1), next: index };
  };

  for (let i = 0; i < source.length; ) {
    const char = source[i];

    if (char === "'") {
      const { content, next } = readUntil(source, i + 1, null, "'");
      current += content;
      quoted = true;
      started = true;
      i = next;
      continue;
    }

    if (char === '"') {
      const { content, next } = readUntil(source, i + 1, null, '"');
      // Une substitution de commande reste active entre guillemets doubles.
      for (const match of content.matchAll(/\$\(([\s\S]*?)\)|`([\s\S]*?)`/g)) {
        subshells.push(match[1] ?? match[2]);
      }
      current += content.replace(/\$\([\s\S]*?\)|`[\s\S]*?`/g, " ");
      quoted = true;
      started = true;
      i = next;
      continue;
    }

    if (char === "`") {
      const { content, next } = readUntil(source, i + 1, null, "`");
      subshells.push(content);
      i = next;
      continue;
    }

    if (char === "$" && source[i + 1] === "(") {
      const { content, next } = readUntil(source, i + 2, "(", ")");
      subshells.push(content);
      i = next;
      continue;
    }

    const operator = OPERATORS.find((op) => source.startsWith(op, i));

    if (operator) {
      pushInvocation();
      i += operator.length;
      continue;
    }

    if (char === " " || char === "\t") {
      pushToken();
      i += 1;
      continue;
    }

    current += char;
    started = true;
    i += 1;
  }

  pushInvocation();

  return { invocations, subshells };
};

/** Enrobages qui précèdent la vraie commande sans la changer. */
const WRAPPERS = new Set([
  "sudo",
  "command",
  "exec",
  "env",
  "stdbuf",
  "nohup",
  "time",
  "nice",
  "xargs",
  "pnpm",
  "npm",
  "npx",
  "yarn",
  "bun",
  "bunx",
  "corepack",
]);

const WRAPPER_SUBCOMMANDS = new Set(["exec", "run", "dlx", "x"]);

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Nom réel de la commande et arguments, une fois les enrobages retirés.
 * `env cat x`, `pnpm --filter app exec cat x` et `sudo rm -rf x` donnent
 * respectivement `cat`, `cat` et `rm`.
 */
export const resolveInvocation = (tokens) => {
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    const value = token.value;

    // Une affectation en tête (`FOO=bar cmd`) n'est pas la commande.
    if (!token.quoted && ASSIGNMENT.test(value)) {
      index += 1;
      continue;
    }

    if (WRAPPERS.has(value)) {
      // `pnpm --filter app exec cat x` : les options du gestionnaire peuvent
      // prendre une valeur, qu'il ne faut pas confondre avec la commande.
      // Quand une sous-commande d'exécution est présente, la vraie commande la
      // suit ; sinon on saute simplement les options.
      const executor = tokens.findIndex(
        (token, position) =>
          position > index && WRAPPER_SUBCOMMANDS.has(token.value)
      );

      index = executor === -1 ? index + 1 : executor + 1;

      while (index < tokens.length && tokens[index].value.startsWith("-")) {
        index += 1;
      }

      continue;
    }

    break;
  }

  // `env` sans rien derrière : l'enrobage EST la commande. Une simple
  // affectation (`FOO=bar`), elle, laisse la commande vide.
  const trailing = tokens.at(-1)?.value ?? "";
  const command =
    tokens[index]?.value ?? (WRAPPERS.has(trailing) ? trailing : "");

  // `mkfs.ext4` compte comme `mkfs` ; `docker-compose` comme `docker`.
  let normalized = command;

  if (command.startsWith("mkfs.")) {
    normalized = "mkfs";
  } else if (command === "docker-compose") {
    normalized = "docker";
  }

  return {
    command: normalized,
    args: tokens.slice(index + 1),
    assignments: tokens.slice(0, index).filter((token) => !token.quoted),
  };
};
