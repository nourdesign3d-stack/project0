"use strict";
/**
 * Configuration dependency-cruiser — carte du dépôt et contrôle des frontières.
 *
 * Exécution : `pnpm graph` (via `pnpm dlx`, aucune dépendance ajoutée au dépôt).
 * Le graphe est une aide à la compréhension, pas une vérité : toute décision
 * importante se confirme dans le code réel.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Une dépendance circulaire rend l'impact d'un changement imprévisible.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-app-to-app",
      severity: "error",
      comment:
        "Une application ne doit jamais importer une autre application (.claude/rules/architecture.md).",
      from: { path: "^apps/([^/]+)/" },
      to: {
        path: "^apps/([^/]+)/",
        pathNot: ["^apps/$1/"],
      },
    },
    {
      name: "no-package-to-app",
      severity: "error",
      comment:
        "Un package partagé ne doit rien savoir des applications qui l'utilisent.",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-orphans",
      severity: "info",
      comment: "Module non importé : code mort probable.",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          // Fichiers de configuration : chargés par un outil, jamais importés.
          "\\.config\\.(ts|tsx|js|cjs|mjs)$",
          // Points d'entrée publics des packages : consommés via package.json
          // depuis un autre workspace, donc invisibles pour le crawler.
          "^packages/[^/]+/[^/]+\\.tsx?$",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: [
        "node_modules",
        "\\.next/",
        "\\.turbo/",
        "packages/database/generated/",
        "test-results/",
        "playwright-report/",
      ],
    },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    reporterOptions: {
      archi: { collapsePattern: "^(apps|packages)/[^/]+" },
    },
  },
};
