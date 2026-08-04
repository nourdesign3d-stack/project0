#!/usr/bin/env node
// Hook PostToolUse déterministe et non bloquant.
// Rappelle les contrôles obligatoires quand un fichier sensible vient d'être modifié.
// Contrat : reçoit le JSON du hook sur stdin, sort toujours en code 0.

const RULES = [
  {
    match: /packages\/database\/prisma\//,
    notice:
      "Schéma Prisma modifié → migration versionnée requise (`pnpm migrate`), compatibilité avec le code déjà déployé, plan de récupération. Voir .claude/rules/database.md",
  },
  {
    match: /\/(route|actions?)\.(ts|tsx)$|\/app\/api\/|\/webhooks?\//,
    notice:
      "Frontière serveur modifiée → validation Zod des entrées, autorisation vérifiée côté serveur, tests positifs ET négatifs. Voir .claude/rules/security.md",
  },
  {
    match: /\.github\/workflows\//,
    notice:
      "Workflow CI modifié → permissions minimales, actions épinglées, aucun `|| true`. Voir .claude/rules/deployment.md",
  },
  {
    match: /package\.json$|pnpm-lock\.yaml$/,
    notice:
      "Dépendances modifiées → justifier l'ajout, vérifier licence et maintenance, relancer `pnpm verify`.",
  },
  {
    match: /\.env(\.|$)/,
    notice:
      "Fichier d'environnement modifié → aucune valeur secrète versionnée ; documenter la variable dans docs/DEPLOYMENT.md.",
  },
];

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
  const filePath =
    payload?.tool_input?.file_path ?? payload?.tool_input?.filePath ?? "";

  if (filePath) {
    const notices = RULES.filter((rule) => rule.match.test(filePath)).map(
      (rule) => rule.notice
    );

    if (notices.length > 0) {
      process.stderr.write(`[repo] ${notices.join("\n[repo] ")}\n`);
    }
  }
} catch {
  // Un hook ne doit jamais bloquer le travail : on échoue en silence.
}

process.exit(0);
