#!/usr/bin/env node
/**
 * Manifeste de composant — ce que ce dépôt expose à un plan de pilotage.
 *
 *   pnpm manifest         écrit manifest.json
 *   pnpm manifest:check   échoue si le fichier versionné n'est plus à jour
 *
 * ── Pourquoi il est **calculé**, jamais rédigé ──
 *
 * Un manifeste écrit à la main serait faux en quarante-huit heures. Ce dépôt en
 * a la preuve : quatorze affirmations documentaires sont devenues fausses en
 * deux jours (D-057), et sept règles périmées ont été trouvées par un agent au
 * travail (D-073). Un manifeste faux est **pire** qu'un document faux : on le
 * regarde dans un tableau de bord, donc on s'y fie.
 *
 * D'où le partage :
 *
 *   déclaré   — ce qui ne se devine pas : l'identité de la capacité et son
 *               fournisseur. Colocalisé dans le `package.json` du package, sous
 *               la clé `capability`, parce qu'un registre central dérive.
 *   dérivé    — tout le reste : versions, variables exigées, consommateurs, et
 *               **le statut**. Un package que personne n'importe est déclaré
 *               inutilisé, quoi qu'en dise son auteur.
 *
 * ── Ce qu'il ne contient pas, et pourquoi ──
 *
 * **Aucune valeur de configuration, jamais.** Savoir si une clé est renseignée
 * dépend de l'environnement, pas du dépôt : c'est l'application en marche qui
 * le dit, par `/manifest` (`apps/api`), et elle ne renvoie que des booléens de
 * présence.
 *
 * **Aucun horodatage.** Le fichier doit être identique d'une exécution à
 * l'autre, sans quoi « à jour » n'est pas vérifiable et chaque génération
 * produit une différence.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "manifest.json");

const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");
const readJson = (...parts) => JSON.parse(read(...parts));

const workspaces = (group) =>
  readdirSync(join(ROOT, group)).filter((name) => {
    try {
      readJson(group, name, "package.json");

      return true;
    } catch {
      return false;
    }
  });

/** Variables d'environnement exigées, lues dans le `keys.ts` du package. */
const ENV_NAME = /^\s{6}([A-Z][A-Z0-9_]*):/gm;
/** Le commit change à chaque révision : il est neutralisé avant comparaison. */
const COMMIT_FIELD = /"commit": "[^"]*"/;

const requiredEnv = (group, name) => {
  try {
    const keys = read(group, name, "keys.ts");

    return [
      ...new Set([...keys.matchAll(ENV_NAME)].map(([, key]) => key)),
    ].sort();
  } catch {
    return [];
  }
};

/** Paquets externes et leurs versions déclarées — la version fait foi ici. */
const providerPackages = (manifest) =>
  Object.entries(manifest.dependencies ?? {})
    .filter(([name]) => !name.startsWith("@repo/"))
    .map(([name, version]) => ({ name, version }))
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Qui importe cette capacité. **Dérivé, jamais déclaré** : c'est ce qui empêche
 * un package abandonné de se prétendre actif. `@repo/ai` et `@repo/storage`
 * l'ont été pendant des semaines sans qu'aucun document ne le dise.
 */
const consumersOf = (packageName) => {
  const found = new Set();

  for (const group of ["apps", "packages"]) {
    for (const name of workspaces(group)) {
      if (`@repo/${name}` === packageName) {
        continue;
      }

      const manifest = readJson(group, name, "package.json");
      const declared = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
      };

      if (packageName in declared) {
        found.add(`${group}/${name}`);
      }
    }
  }

  return [...found].sort();
};

/**
 * `building` est le seul statut **déclarable** — il exprime une intention que le
 * dépôt ne peut pas deviner. Les deux autres sont dérivés de l'usage réel : un
 * package sans consommateur ne peut pas se dire actif.
 */
const statusOf = (declared, consumers) => {
  if (declared.status === "building") {
    return "building";
  }

  return consumers.length > 0 ? "active" : "unused";
};

const capabilities = workspaces("packages").map((name) => {
  const manifest = readJson("packages", name, "package.json");
  const declared = manifest.capability ?? {};
  const consumers = consumersOf(manifest.name);

  return {
    id: declared.id ?? name,
    package: manifest.name,
    provider: declared.provider ?? null,
    criticality: declared.criticality ?? "unknown",
    status: statusOf(declared, consumers),
    providerPackages: providerPackages(manifest),
    requiredEnv: requiredEnv("packages", name),
    consumers,
  };
});

const applications = workspaces("apps").map((name) => {
  const manifest = readJson("apps", name, "package.json");

  return {
    name,
    version: manifest.version ?? null,
    capabilities: Object.keys(manifest.dependencies ?? {})
      .filter((dependency) => dependency.startsWith("@repo/"))
      .sort(),
  };
});

const root = readJson("package.json");

const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT })
      .toString()
      .trim();
  } catch {
    // Hors dépôt Git : le manifeste reste valide, il n'est simplement pas
    // rattachable à une révision. Le dire vaut mieux que d'inventer.
    return null;
  }
})();

const manifest = {
  schemaVersion: 1,
  component: { name: root.name, version: root.version ?? null, commit },
  capabilities: capabilities.sort((a, b) => a.id.localeCompare(b.id)),
  applications,
};

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

/**
 * Second artefact : la carte « capacité → variables exigées », en TypeScript,
 * pour que `apps/api` la lise **par un import** plutôt qu'en cherchant un
 * fichier à l'exécution. Un chemin résolu au runtime casse en environnement
 * serverless ; un import est vérifié à la compilation.
 */
const generated = `// Généré par \`pnpm manifest\` — ne pas modifier à la main.
//
// La route /manifest s'en sert pour dire **quelles variables sont présentes**,
// jamais leur valeur. C'est la seule chose que le dépôt ne peut pas savoir :
// elle dépend de l'environnement, pas du code.

export const CAPABILITY_ENV: ReadonlyArray<{
  readonly id: string;
  readonly provider: string | null;
  readonly criticality: string;
  readonly requiredEnv: readonly string[];
}> = ${JSON.stringify(
  manifest.capabilities.map(({ id, provider, criticality, requiredEnv }) => ({
    id,
    provider,
    criticality,
    requiredEnv,
  })),
  null,
  2
)};
`;

if (process.argv.includes("--check")) {
  const current = (() => {
    try {
      return read("manifest.json");
    } catch {
      return "";
    }
  })();

  // Le commit change à chaque révision : le comparer ferait échouer le contrôle
  // en permanence. Ce qui doit rester à jour, c'est la **composition**.
  const withoutCommit = (text) => text.replace(COMMIT_FIELD, '"commit": null');

  const currentGenerated = (() => {
    try {
      return read("apps/api/app/manifest/capabilities.generated.ts");
    } catch {
      return "";
    }
  })();

  if (
    withoutCommit(current) !== withoutCommit(serialized) ||
    currentGenerated !== generated
  ) {
    process.stdout.write(
      "\n  manifest.json n'est plus à jour. Régénérer : pnpm manifest\n\n"
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n  manifeste à jour — ${manifest.capabilities.length} capacités, ${applications.length} applications.\n\n`
  );
  process.exit(0);
}

writeFileSync(OUTPUT, serialized);

writeFileSync(
  join(ROOT, "apps/api/app/manifest/capabilities.generated.ts"),
  generated
);

const byStatus = manifest.capabilities.reduce((counts, capability) => {
  counts[capability.status] = (counts[capability.status] ?? 0) + 1;

  return counts;
}, {});

process.stdout.write(
  `\n  manifest.json écrit — ${manifest.capabilities.length} capacités ` +
    `(${Object.entries(byStatus)
      .map(([status, count]) => `${count} ${status}`)
      .join(", ")}), ${applications.length} applications.\n\n`
);
