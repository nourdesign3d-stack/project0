#!/usr/bin/env node
/**
 * Tests des scripts d'amorçage. Exécution : node scripts/scripts.test.mjs
 *
 * Motivation : ces scripts décident du contenu d'un projet neuf et n'avaient
 * aucun test. Le défaut le plus grave trouvé en audit — une copie qui hérite des
 * fichiers d'environnement du projet source, donc de sa base de données — aurait
 * été attrapé ici. Le premier cas ci-dessous est exactement cette régression.
 *
 * Chaque cas travaille sur une arborescence jetable dans le dossier temporaire :
 * les scripts résolvent leur racine depuis leur propre emplacement, il suffit
 * donc de les copier dans <tmp>/scripts/.
 */

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withValue } from "./lib/env-file.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const LOCAL_ENV = `.env${".local"}`;

/** Arborescence minimale : ce dont les scripts ont réellement besoin. */
const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "seed-scripts-"));

  mkdirSync(join(root, "scripts/lib"), { recursive: true });
  mkdirSync(join(root, "docs/_skeletons"), { recursive: true });
  mkdirSync(join(root, "apps/app"), { recursive: true });

  for (const helper of ["env-file.mjs", "database-url.mjs"]) {
    copyFileSync(
      join(repo, "scripts/lib", helper),
      join(root, "scripts/lib", helper)
    );
  }

  for (const script of [
    "project-init.mjs",
    "setup-env.mjs",
    "install-hooks.mjs",
    "set-env.mjs",
    "db-backup.mjs",
    "db-restore.mjs",
  ]) {
    copyFileSync(join(repo, "scripts", script), join(root, "scripts", script));
  }

  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "ancien-projet", version: "0.0.0" }, null, 2)}\n`
  );
  writeFileSync(
    join(root, "README.md"),
    "# ancien-projet\n\nTexte générique.\n"
  );

  for (const file of [
    "PROJECT_CONTEXT.md",
    "DOMAIN_MODEL.md",
    "DATA_DICTIONARY.md",
    "ASSUMPTIONS.md",
    "RISKS.md",
    "DECISIONS.md",
  ]) {
    writeFileSync(join(root, "docs/_skeletons", file), `# squelette ${file}\n`);
    writeFileSync(join(root, "docs", file), `# journal de l'ancien projet\n`);
  }

  writeFileSync(
    join(root, "apps/app/.env.example"),
    [
      'DATABASE_URL=""',
      'BETTERSTACK_URL=""',
      'NEXT_PUBLIC_APP_URL="http://localhost:3000"',
      "",
    ].join("\n")
  );

  return root;
};

const init = (root, args) =>
  execFileSync(
    process.execPath,
    [join(root, "scripts/project-init.mjs"), ...args],
    { cwd: root, stdio: "pipe" }
  ).toString();

const read = (root, path) => readFileSync(join(root, path), "utf8");

const cases = [];
const check = (name, run) => cases.push({ name, run });
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

// --- Régression B1 : le défaut bloquant trouvé en audit ---------------------

check(
  "une copie qui change de nom ne garde pas l'environnement du projet source",
  (root) => {
    // Simule une copie brute : le fichier d'environnement de l'ancien projet
    // est présent, et pointe sur SA base de données.
    writeFileSync(
      join(root, "apps/app", LOCAL_ENV),
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5434/ancien-projet"\n'
    );

    init(root, ["--name", "nouveau", "--port", "5599"]);

    const env = read(root, join("apps/app", LOCAL_ENV));

    assert(
      !env.includes("ancien-projet"),
      "la base du projet source est toujours référencée"
    );
    assert(
      env.includes("5599/nouveau"),
      "la base du nouveau projet n'est pas configurée"
    );
  }
);

// --- R-017 : la copie qui garde le même nom ---------------------------------
//
// Le jeu de tests précédent n'exerçait que le cas renommé. Une copie vers un
// dossier portant le nom du projet source conservait donc ses environnements,
// et sa base de données. Relevé par l'audit du 2026-08-05.

check(
  "à nom inchangé, un environnement existant fait échouer plutôt qu'hériter",
  (root) => {
    writeFileSync(
      join(root, "apps/app", LOCAL_ENV),
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5434/ancien-projet"\n'
    );

    let refused = false;
    let message = "";

    try {
      init(root, ["--name", "ancien-projet", "--port", "5599"]);
    } catch (error) {
      refused = true;
      message = (error.stderr ?? "").toString();
    }

    assert(refused, "l'environnement du projet source a été hérité en silence");
    assert(
      message.includes("--fresh") && message.includes("--keep-env"),
      "le refus n'explique pas comment le lever"
    );
    assert(
      read(root, join("apps/app", LOCAL_ENV)).includes("ancien-projet"),
      "le fichier a été supprimé alors que le refus devait le préserver"
    );
  }
);

check("--fresh régénère l'environnement même à nom inchangé", (root) => {
  writeFileSync(
    join(root, "apps/app", LOCAL_ENV),
    'DATABASE_URL="postgresql://postgres:postgres@localhost:5434/ancien-projet"\n'
  );

  init(root, ["--name", "ancien-projet", "--port", "5599", "--fresh"]);

  const env = read(root, join("apps/app", LOCAL_ENV));

  assert(
    env.includes("5599/ancien-projet") && !env.includes("5434"),
    "l'environnement n'a pas été régénéré"
  );
});

check("--keep-env conserve l'environnement, sans échouer", (root) => {
  writeFileSync(
    join(root, "apps/app", LOCAL_ENV),
    'DATABASE_URL="postgresql://postgres:postgres@localhost:5434/ancien-projet"\n'
  );

  init(root, ["--name", "ancien-projet", "--port", "5599", "--keep-env"]);

  assert(
    read(root, join("apps/app", LOCAL_ENV)).includes("5434"),
    "l'environnement a été modifié malgré --keep-env"
  );
});

check("les caches de build par workspace sont supprimés", (root) => {
  for (const path of [".turbo", "apps/app/.turbo", "apps/app/.next"]) {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, "cache"), "résidu\n");
  }

  init(root, ["--name", "nouveau", "--port", "5599"]);

  for (const path of [".turbo", "apps/app/.turbo", "apps/app/.next"]) {
    assert(!existsSync(join(root, path)), `${path} n'a pas été supprimé`);
  }
});

check("les résidus du projet source sont supprimés", (root) => {
  mkdirSync(join(root, ".clerk"), { recursive: true });
  writeFileSync(join(root, ".clerk/keys"), "instance éphémère\n");

  init(root, ["--name", "nouveau", "--port", "5599"]);

  assert(!existsSync(join(root, ".clerk")), ".clerk n'a pas été supprimé");
});

// --- Comportement nominal ---------------------------------------------------

check("le nom est inscrit dans package.json et le titre du README", (root) => {
  init(root, ["--name", "nouveau", "--port", "5599"]);

  assert(
    JSON.parse(read(root, "package.json")).name === "nouveau",
    "package.json non renommé"
  );
  assert(
    read(root, "README.md").startsWith("# nouveau\n"),
    "titre du README non renommé"
  );
  assert(
    read(root, "README.md").includes("Texte générique"),
    "le reste du README a été perdu"
  );
});

check("les documents journal reviennent à leur squelette", (root) => {
  init(root, ["--name", "nouveau", "--port", "5599"]);

  assert(
    read(root, "docs/RISKS.md").startsWith("# squelette"),
    "le journal de l'ancien projet subsiste"
  );
});

check("--keep-docs préserve les documents journal", (root) => {
  init(root, ["--name", "nouveau", "--port", "5599", "--keep-docs"]);

  assert(
    read(root, "docs/RISKS.md").includes("ancien projet"),
    "les documents ont été écrasés malgré --keep-docs"
  );
});

check("--dry-run n'écrit rien", (root) => {
  init(root, ["--name", "nouveau", "--port", "5599", "--dry-run"]);

  assert(
    JSON.parse(read(root, "package.json")).name === "ancien-projet",
    "package.json modifié malgré --dry-run"
  );
});

// --- setup-env --------------------------------------------------------------

check(
  "les variables sans valeur sont commentées, pas laissées vides",
  (root) => {
    init(root, ["--name", "nouveau", "--port", "5599"]);

    const env = read(root, join("apps/app", LOCAL_ENV));

    assert(
      env.includes('# BETTERSTACK_URL=""'),
      "une variable vide reste active et fera échouer la validation Zod"
    );
    assert(
      env.includes('NEXT_PUBLIC_APP_URL="http://localhost:3000"'),
      "une variable renseignée a été commentée à tort"
    );
  }
);

check("le fichier d'environnement est créé en 0600", (root) => {
  init(root, ["--name", "nouveau", "--port", "5599"]);

  // Les bits de permission sont les 9 derniers du mode : un modulo les isole
  // sans opérateur binaire, que le lint interdit ici.
  const mode = statSync(join(root, "apps/app", LOCAL_ENV)).mode % 0o1000;

  assert(
    mode === 0o600,
    `permissions attendues 600, obtenues ${mode.toString(8)}`
  );
});

// --- Refus ------------------------------------------------------------------

check("un nom invalide est refusé", (root) => {
  let refused = false;

  try {
    init(root, ["--name", "Nom Invalide"]);
  } catch {
    refused = true;
  }

  assert(refused, "un nom invalide a été accepté");
});

check("un port invalide est refusé", (root) => {
  let refused = false;

  try {
    init(root, ["--name", "nouveau", "--port", "abc"]);
  } catch {
    refused = true;
  }

  assert(refused, "un port invalide a été accepté");
});

// --- set-env ----------------------------------------------------------------

/**
 * La saisie de la valeur exige un terminal : ces cas couvrent tout ce qui la
 * précède — validation des arguments, recherche des fichiers concernés — et le
 * refus explicite hors TTY. Sans eux, une faute de frappe dans le nom de la
 * variable passerait pour un succès silencieux.
 */
const setEnv = (root, args) => {
  try {
    return {
      status: 0,
      output: execFileSync(
        process.execPath,
        [join(root, "scripts", "set-env.mjs"), ...args],
        { cwd: root, stdio: ["pipe", "pipe", "pipe"] }
      ).toString(),
    };
  } catch (error) {
    return {
      status: error.status,
      output: `${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`,
    };
  }
};

cases.push({
  name: "set-env : refuse un nom de variable invalide",
  run: (root) => {
    for (const argument of [[], ["database_url"], ["1FOO"]]) {
      const { status, output } = setEnv(root, argument);

      assert(
        status === 1,
        `sortie inattendue pour ${JSON.stringify(argument)}`
      );
      assert(output.includes("Usage"), "l'usage n'est pas rappelé");
    }
  },
});

cases.push({
  name: "set-env : signale une variable que personne ne déclare",
  run: (root) => {
    const { status, output } = setEnv(root, ["VARIABLE_ABSENTE"]);

    assert(status === 1, "une variable inconnue a été acceptée");
    assert(
      output.includes("Aucun .env.local ne déclare"),
      "le motif du refus n'est pas explicite"
    );
  },
});

cases.push({
  name: "set-env : liste les fichiers concernés avant de refuser hors terminal",
  run: (root) => {
    // La fixture ne contient pas de .env.local : on en pose un.
    writeFileSync(
      join(root, "apps/app", LOCAL_ENV),
      'DATABASE_URL=""\n# STRIPE_SECRET_KEY=\n'
    );

    const { status, output } = setEnv(root, ["DATABASE_URL"]);

    assert(status === 1, "la saisie a été tentée sans terminal");
    assert(
      output.includes(join("apps", "app", LOCAL_ENV)),
      "le fichier concerné n'est pas annoncé"
    );
    assert(
      output.includes("interactif"),
      "l'exigence de terminal n'est pas expliquée"
    );
  },
});

cases.push({
  name: "set-env : reconnaît une variable commentée",
  run: (root) => {
    // `setup-env.mjs` commente les variables sans valeur : ce sont exactement
    // celles que l'on vient renseigner. Les ignorer rendrait l'outil inutile.
    writeFileSync(join(root, "apps/app", LOCAL_ENV), "# STRIPE_SECRET_KEY=\n");

    const { output } = setEnv(root, ["STRIPE_SECRET_KEY"]);

    assert(
      output.includes("1 fichier(s)"),
      "une variable commentée n'a pas été reconnue"
    );
  },
});

cases.push({
  name: "set-env : écrit la valeur, guillemets compris",
  run: () => {
    const written = withValue(
      'DATABASE_URL=""\nAUTRE=1\n',
      "DATABASE_URL",
      "postgresql://u:p@h/db?sslmode=require&channel_binding=require"
    );

    assert(
      written.includes(
        'DATABASE_URL="postgresql://u:p@h/db?sslmode=require&channel_binding=require"'
      ),
      "la valeur n'est pas écrite entre guillemets"
    );
    assert(written.includes("AUTRE=1"), "le reste du fichier a été altéré");
  },
});

cases.push({
  name: "set-env : ne laisse aucune déclaration périmée derrière lui",
  run: () => {
    // `dotenv` retient la **dernière** définition : ne remplacer que la première
    // laisserait une valeur périmée qui écraserait silencieusement la nouvelle.
    const written = withValue(
      '# DATABASE_URL=\nAUTRE=1\nDATABASE_URL="ancienne"\n',
      "DATABASE_URL",
      "nouvelle"
    );

    assert(!written.includes("ancienne"), "une déclaration périmée subsiste");
    assert(
      !written.includes("# DATABASE_URL="),
      "la déclaration commentée subsiste"
    );
  },
});

cases.push({
  name: "set-env : ne confond pas deux variables de préfixe commun",
  run: () => {
    const written = withValue(
      'DATABASE_URL=""\nDATABASE_URL_REPLICA="intacte"\n',
      "DATABASE_URL",
      "nouvelle"
    );

    assert(
      written.includes('DATABASE_URL_REPLICA="intacte"'),
      "une variable au préfixe commun a été écrasée"
    );
  },
});

cases.push({
  name: "set-env : refuse un dossier racine inexistant",
  run: (root) => {
    const { status, output } = setEnv(root, [
      "DATABASE_URL",
      "--root",
      join(root, "nulle-part"),
    ]);

    assert(status === 1, "un dossier inexistant a été accepté");
    assert(output.includes("introuvable"), "le motif du refus est muet");
  },
});

// --- Sauvegarde et restauration ---------------------------------------------

/**
 * R-004. Ces cas couvrent les **refus** : ce qui protège d'une restauration
 * lancée sur la mauvaise base, ou d'une sauvegarde écrasée par la suivante.
 * Le cycle complet (sauvegarde d'une base distante, restauration ailleurs,
 * contrôle du contenu) a été exécuté à la main et est décrit dans
 * `docs/RECOVERY.md` — il exige un conteneur et une base, pas une fixture.
 */
const runScript = (root, script, args, env = {}) => {
  // L'environnement est fourni explicitement : la CI définit `DATABASE_URL` au
  // niveau du workflow, et un cas qui reposait sur son absence passait en local
  // pour échouer là-bas. Un test ne doit pas dépendre de ce qui l'entoure.
  const options = {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  };

  try {
    return {
      status: 0,
      output: execFileSync(
        process.execPath,
        [join(root, "scripts", script), ...args],
        options
      ).toString(),
    };
  } catch (error) {
    return {
      status: error.status,
      output: `${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`,
    };
  }
};

cases.push({
  name: "db:restore : exige une cible déclarée",
  run: (root) => {
    writeFileSync(join(root, "sauvegarde.dump"), "factice");

    for (const args of [
      ["sauvegarde.dump"],
      ["sauvegarde.dump", "--yes"],
      ["sauvegarde.dump", "--to", "production", "--yes"],
    ]) {
      const { status, output } = runScript(root, "db-restore.mjs", args);

      assert(status === 1, `cible acceptée à tort : ${args.join(" ")}`);
      assert(output.includes("Usage"), "l'usage n'est pas rappelé");
    }
  },
});

cases.push({
  name: "db:restore : ne fait rien sans --yes, et annonce la cible",
  run: (root) => {
    writeFileSync(join(root, "sauvegarde.dump"), "factice");

    const { status, output } = runScript(root, "db-restore.mjs", [
      "sauvegarde.dump",
      "--to",
      "local",
    ]);

    assert(status === 1, "la restauration a été tentée sans confirmation");
    assert(output.includes("Cible"), "la cible n'est pas annoncée");
    assert(output.includes("--yes"), "la confirmation attendue n'est pas dite");
  },
});

cases.push({
  name: "db:restore : refuse une sauvegarde introuvable",
  run: (root) => {
    const { status, output } = runScript(root, "db-restore.mjs", [
      "absente.dump",
      "--to",
      "local",
      "--yes",
    ]);

    assert(status === 1, "un fichier absent a été accepté");
    assert(output.includes("introuvable"), "le motif du refus est muet");
  },
});

cases.push({
  name: "db:restore : --yes ne suffit pas pour une base distante",
  run: (root) => {
    // `--yes` était lu dans le même argv que `--to database-url` : une ligne
    // collée restaurait sans second geste humain — précisément ce que l'en-tête
    // du script prétendait empêcher. Hors terminal, le refus doit être net.
    writeFileSync(join(root, "sauvegarde.dump"), "factice");

    const { status, output } = runScript(
      root,
      "db-restore.mjs",
      ["sauvegarde.dump", "--to", "database-url", "--yes"],
      { DATABASE_URL: "postgresql://u:p@ailleurs.example/production" }
    );

    assert(status === 1, "une base distante a été restaurée sans terminal");
    assert(
      output.includes("interactive"),
      "le refus n'explique pas qu'une confirmation au terminal est exigée"
    );
  },
});

cases.push({
  name: "db:backup : refuse d'écraser une sauvegarde existante",
  run: (root) => {
    // Écraser une sauvegarde est la meilleure façon de n'en avoir aucune.
    writeFileSync(join(root, "deja-la.dump"), "précédente");

    const { status, output } = runScript(root, "db-backup.mjs", [
      "--out",
      "deja-la.dump",
    ]);

    assert(status === 1, "une sauvegarde existante a été écrasée");
    assert(output.includes("existe déjà"), "le motif du refus est muet");
    assert(
      read(root, "deja-la.dump") === "précédente",
      "le fichier a été modifié malgré le refus"
    );
  },
});

cases.push({
  name: "db:backup : explique l'absence de DATABASE_URL",
  run: (root) => {
    const { status, output } = runScript(root, "db-backup.mjs", [], {
      DATABASE_URL: "",
    });

    assert(status === 1, "la sauvegarde a été tentée sans cible");
    assert(
      output.includes("DATABASE_URL") && output.includes("env:set"),
      "le message n'indique pas comment renseigner la cible"
    );
  },
});

check(
  "db:backup : une URL locale est traduite vers le point de vue du conteneur",
  async () => {
    // Les outils tournent DANS le conteneur, où Postgres écoute sur 5432, mais
    // DATABASE_URL décrit la base telle que l'HÔTE la voit. Tant que
    // POSTGRES_PORT valait 5432 les deux coïncidaient ; dès qu'il change, la
    // sauvegarde échouait sur un refus de connexion (D-047).
    const { forContainer } = await import("./lib/database-url.mjs");

    assert(
      forContainer("postgresql://postgres:motdepasse@localhost:5433/app") ===
        "postgresql://postgres:motdepasse@localhost:5432/app",
      "un port publié non standard n'est pas ramené à 5432"
    );

    assert(
      forContainer("postgresql://u:p@127.0.0.1:15432/app").includes(":5432/"),
      "127.0.0.1 n'est pas traité comme un hôte local"
    );
  }
);

check("db:backup : une URL distante n'est jamais réécrite", async () => {
  // Une base Neon est déjà exprimée du point de vue du réseau : la traduire
  // ferait pointer la sauvegarde sur le conteneur local.
  const { forContainer } = await import("./lib/database-url.mjs");
  const remote = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech:5432/app";

  assert(forContainer(remote) === remote, "une URL distante a été réécrite");

  const other = "postgresql://u:p@db.exemple.test:6543/app";

  assert(
    forContainer(other) === other,
    "un port distant non standard a été écrasé"
  );
});

check("db:backup : une URL illisible est laissée telle quelle", async () => {
  // La transformer en silence produirait une erreur qui ne la concerne pas.
  const { forContainer } = await import("./lib/database-url.mjs");

  assert(
    forContainer("pas une URL") === "pas une URL",
    "URL illisible altérée"
  );
});

check("rétention : les 30 derniers jours sont tous conservés", async () => {
  const { applyRetention } = await import("./lib/retention.mjs");
  const now = new Date("2026-08-07T12:00:00Z");
  const backups = [0, 1, 5, 15, 29].map((d) => ({
    name: `j-${d}`,
    date: new Date(now.getTime() - d * 86_400_000),
  }));

  const { remove } = applyRetention(backups, now);

  assert(remove.length === 0, `${remove.length} sauvegarde récente supprimée`);
});

check("rétention : au-delà, une seule par mois est gardée", async () => {
  const { applyRetention } = await import("./lib/retention.mjs");
  const now = new Date("2026-08-07T12:00:00Z");
  // Une sauvegarde récente, pour que la garde « jamais la plus récente » ne
  // porte pas sur le mois ancien et que la règle mensuelle soit seule en cause.
  const backups = [
    { name: "hier", date: new Date("2026-08-06T00:00:00Z") },
    { name: "mai-01", date: new Date("2026-05-01T00:00:00Z") },
    { name: "mai-15", date: new Date("2026-05-15T00:00:00Z") },
    { name: "mai-28", date: new Date("2026-05-28T00:00:00Z") },
  ];

  const { keep, remove } = applyRetention(backups, now);

  // La plus ancienne du mois : c'est celle qui précède les changements du mois.
  assert(keep.includes("mai-01"), "mai-01 n'est pas conservée");
  assert(keep.includes("hier"), "la sauvegarde récente n'est pas conservée");
  assert(keep.length === 2, `${keep.length} conservées au lieu de deux`);
  assert(
    remove.includes("mai-15") && remove.includes("mai-28"),
    "les deux sauvegardes intermédiaires du mois devaient partir"
  );
});

check("rétention : la plus récente n'est jamais supprimée", async () => {
  // Si l'automatisation s'arrête des mois, la rétention ne doit pas achever le
  // travail en effaçant la dernière copie — c'est le moment où elle compte le
  // plus.
  const { applyRetention } = await import("./lib/retention.mjs");
  const now = new Date("2028-01-01T00:00:00Z");
  const backups = [{ name: "unique", date: new Date("2026-05-01T00:00:00Z") }];

  const { keep, remove } = applyRetention(backups, now);

  assert(remove.length === 0, "la dernière sauvegarde a été supprimée");
  assert(keep[0] === "unique", "la dernière sauvegarde n'est pas conservée");
});

check("rétention : un fichier étranger n'est jamais candidat", async () => {
  // Le dossier peut contenir autre chose que des dumps — journal, notes. Un nom
  // non conforme ne doit pas être supprimé « au passage ».
  const { dateFromName } = await import("./lib/retention.mjs");

  assert(dateFromName("journal.log") === null, "journal.log pris pour un dump");
  assert(dateFromName("notes.txt") === null, "notes.txt pris pour un dump");
  assert(
    dateFromName(".derniere-reussite") === null,
    "marqueur pris pour un dump"
  );
  assert(
    dateFromName("2026-08-07T12-30-00.dump") instanceof Date,
    "un dump valide n'est pas reconnu"
  );
});

check(
  "un projet fraîchement initialisé passe le contrôle du dictionnaire",
  () => {
    // ⚠️ `DATA_DICTIONARY.md` fait partie des documents remis à zéro par
    // l'initialisation, mais `WebhookEvent` **reste** dans le schéma : c'est un
    // modèle d'infrastructure, pas de domaine. Le squelette ne le mentionnait
    // pas, et `documentation-claims.test.ts` échouait donc sur **tout** projet
    // neuf — le tout premier `pnpm verify` d'un repreneur (D-072).
    //
    // Ce contrôle relie les deux : le squelette doit couvrir chaque modèle que
    // la graine livre. Il vit ici parce que c'est l'initialisation qui crée le
    // couplage.
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const schema = readFileSync(
      join(root, "packages/database/prisma/schema.prisma"),
      "utf8"
    );
    const skeleton = readFileSync(
      join(root, "docs/_skeletons/DATA_DICTIONARY.md"),
      "utf8"
    );

    const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
      ([, name]) => name
    );

    assert(
      models.length > 0,
      "aucun modèle trouvé : le chemin a-t-il changé ?"
    );

    for (const model of models) {
      assert(
        skeleton.includes(model),
        `le squelette du dictionnaire ignore ${model} : un projet neuf échouera à son premier pnpm verify`
      );
    }
  }
);

check("les squelettes ne parlent que de ce qui existe encore", () => {
  // ⚠️ `docs/_skeletons/` était le seul dossier du dépôt qu'aucun test ne lisait,
  // et il a dérivé quatre fois : `Page` supprimé (D-070) mais toujours listé,
  // `relationMode` retiré (D-065) mais toujours décrit, R-002 fermé mais toujours
  // livré, BaseHub retiré (D-031) mais toujours mentionné.
  //
  // Chaque projet neuf héritait donc d'un modèle inexistant, d'une contrainte
  // disparue et d'un risque déjà résolu. Relevé par le premier usage réel de la
  // graine (D-072).
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const schema = readFileSync(
    join(root, "packages/database/prisma/schema.prisma"),
    "utf8"
  );
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
    ([, name]) => name
  );

  // Retiré du dépôt : plus aucun texte destiné au repreneur ne doit y renvoyer.
  //
  // ⚠️ Comparaison **insensible à la casse** : la première version cherchait
  // « BaseHub » et laissait passer « BASEHUB_TOKEN », que le squelette des
  // risques contenait toujours. Trouvé par le premier agent travaillant sur un
  // projet dérivé (D-073).
  const REMOVED = ["relationmode", "basehub", "adapter-neon"];

  // `.claude/rules/` est lu par tout agent à chaque tâche : une règle périmée y
  // coûte plus cher qu'ailleurs, parce qu'elle est appliquée.
  const SOURCES = [
    ...readdirSync(join(root, "docs/_skeletons")).map((f) =>
      join("docs/_skeletons", f)
    ),
    ...readdirSync(join(root, ".claude/rules")).map((f) =>
      join(".claude/rules", f)
    ),
  ];

  for (const file of SOURCES) {
    const content = readFileSync(join(root, file), "utf8");
    const lowered = content.toLowerCase();

    for (const term of REMOVED) {
      assert(
        !lowered.includes(term),
        `${file} mentionne « ${term} », retiré du dépôt : un projet neuf en hériterait`
      );
    }

    // Un squelette peut nommer un modèle **qui existe**, jamais un disparu.
    for (const [, named] of content.matchAll(
      /`(\w+)` \| `packages\/database/g
    )) {
      assert(
        models.includes(named),
        `${file} décrit le modèle ${named}, absent du schéma`
      );
    }
  }
});

// --- Exécution --------------------------------------------------------------

let failures = 0;

for (const { name, run } of cases) {
  const root = makeFixture();

  try {
    await run(root);
  } catch (error) {
    failures += 1;
    process.stdout.write(`  ✗ ${name}\n      ${error.message}\n`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

process.stdout.write(
  failures === 0
    ? `  ${cases.length} cas vérifiés, aucun écart.\n`
    : `  ${failures} écart(s) sur ${cases.length} cas.\n`
);

process.exit(failures === 0 ? 0 : 1);
