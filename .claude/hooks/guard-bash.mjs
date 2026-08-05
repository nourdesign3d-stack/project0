#!/usr/bin/env node
/**
 * Hook PreToolUse — refuse les commandes Bash dangereuses.
 *
 * Pourquoi un hook et pas seulement `permissions.deny` : la liste `deny` compare
 * des préfixes de commande, et ses motifs de lecture ne visent que l'outil Read.
 * `cat apps/app/.env.local` échappe donc au refus de lecture, et `find . -delete`
 * échappe au refus de `rm -rf`. Le hook inspecte la ligne de commande entière,
 * quel que soit l'outil employé.
 *
 * Ce que ce hook est : un garde-fou déterministe contre l'erreur et le
 * contournement accidentel.
 *
 * Ce qu'il n'est PAS : une frontière de sécurité. Une commande suffisamment
 * obscurcie (variables, encodage, shell imbriqué, script tiers) passera. La vraie
 * protection reste de ne jamais placer de secret de production sur un poste de
 * développement. Voir docs/SECURITY_MODEL.md.
 *
 * Contrat : JSON du hook sur stdin ; sortie 2 + message sur stderr = refus ;
 * sortie 0 = laisser passer.
 */

const SECRET_PATHS = [
  // Fichiers d'environnement réels — .env.example est explicitement toléré.
  /(^|[\s"'=/])\.env(\.local|\.production|\.development|\.test)?([\s"';|&)]|$)/,
  /\.env\.[a-z]+\.local/,
  /\.ssh\//,
  /\.aws\/(credentials|config)/,
  /id_rsa/,
  /\.pem([\s"';|&)]|$)/,
  /\.p12([\s"';|&)]|$)/,
  /\.keystore/,
];

const DESTRUCTIVE = [
  {
    pattern: /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+/,
    why: "suppression récursive ou forcée",
  },
  {
    pattern: /\bfind\b[^|;]*\s-delete\b/,
    why: "suppression de masse via find",
  },
  {
    pattern: /\bfind\b[^|;]*-exec\s+rm\b/,
    why: "suppression de masse via find -exec",
  },
  {
    pattern: /\bgit\b[^|;]*\breset\s+--hard\b/,
    why: "perte du travail non sauvegardé",
  },
  {
    pattern: /\bgit\b[^|;]*\bclean\s+-[a-zA-Z]*[dfx]/,
    why: "suppression de fichiers non suivis",
  },
  {
    pattern: /\bgit\b[^|;]*\bpush\b[^|;]*(--force(?!-with-lease)|\s-f\b)/,
    why: "réécriture de l'historique distant",
  },
  {
    pattern: /\bgit\b[^|;]*\bbranch\s+-D\b/,
    why: "suppression de branche non fusionnée",
  },
  {
    pattern: /\bprisma\b[^|;]*\bmigrate\s+reset\b/,
    why: "destruction de la base",
  },
  {
    pattern: /\bprisma\b[^|;]*\bdb\s+push\b/,
    why: "modification de schéma hors migration versionnée",
  },
  {
    pattern: /\bdb:push\b/,
    why: "modification de schéma hors migration versionnée",
  },
  {
    pattern: /\bdocker\b[^|;]*\bcompose\b[^|;]*\bdown\b[^|;]*-v\b/,
    why: "destruction du volume de données",
  },
  {
    pattern: /\bdocker\b[^|;]*\bvolume\s+rm\b/,
    why: "destruction d'un volume",
  },
  {
    pattern: /\bdocker\b[^|;]*\bsystem\s+prune\b/,
    why: "nettoyage destructif global",
  },
  { pattern: /\bmkfs\b|\bdd\s+if=/, why: "écriture disque de bas niveau" },
  { pattern: /\bchmod\s+-R\s+777\b/, why: "permissions dangereuses" },
  {
    pattern: /\b(curl|wget)\b[^|;]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/,
    why: "exécution de code téléchargé",
  },
  {
    pattern: /\bvercel\b\s+(deploy|--prod|env\s+(add|rm))/,
    why: "action sur un environnement déployé",
  },
  {
    pattern: /\b(env|printenv)\s*$/,
    why: "affichage de l'environnement complet",
  },
];

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const deny = (reason, detail) => {
  process.stderr.write(
    "\n  ✗ Commande refusée par .claude/hooks/guard-bash.mjs\n" +
      `    Motif : ${reason}\n` +
      `    ${detail}\n\n` +
      "    Si l'action est réellement voulue, c'est à l'humain de la lancer.\n\n"
  );
  process.exit(2);
};

try {
  const raw = await readStdin();
  const payload = raw ? JSON.parse(raw) : {};

  if (payload?.tool_name !== "Bash") {
    process.exit(0);
  }

  const command = String(payload?.tool_input?.command ?? "");
  // `.env.example` est versionné et sans valeur : il ne doit pas déclencher le garde-fou.
  const probe = command.replaceAll(".env.example", "«example»");

  for (const pattern of SECRET_PATHS) {
    if (pattern.test(probe)) {
      deny(
        "accès à un fichier de secrets",
        "Les .env.local, clés et identifiants ne se lisent pas depuis un agent."
      );
    }
  }

  for (const { pattern, why } of DESTRUCTIVE) {
    if (pattern.test(command)) {
      deny(
        `commande destructive — ${why}`,
        `Commande : ${command.slice(0, 120)}`
      );
    }
  }
} catch {
  // Un hook illisible ne doit pas bloquer le travail : on laisse passer et on le dit.
  process.stderr.write(
    "  guard-bash : entrée illisible, commande non inspectée.\n"
  );
}

process.exit(0);
