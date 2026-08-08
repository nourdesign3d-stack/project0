import { CAPABILITY_ENV } from "./capabilities.generated";

/**
 * État d'exécution des capacités — la seule chose que le dépôt ne peut pas
 * savoir.
 *
 * `manifest.json` décrit la **composition** : quelles capacités existent, chez
 * quel fournisseur, dans quelle version, avec quelles variables exigées. Il est
 * généré depuis le code, donc vrai par construction.
 *
 * Ce qu'il ne peut pas dire, c'est si une capacité est **réellement branchée** :
 * cela dépend de l'environnement où l'application tourne, pas du dépôt. Cette
 * route le dit, pour l'environnement dans lequel elle s'exécute.
 *
 * ⚠️ **Aucune valeur n'est lue, jamais.** Seule la présence d'un nom de variable
 * est renvoyée, sous forme de booléen. Une route qui dirait « la clé Stripe
 * commence par sk_live » serait une fuite ; une route qui dit « la clé Stripe
 * est présente » est un état d'exploitation.
 *
 * ⚠️ **Refus par défaut.** Sans `MANIFEST_TOKEN`, la route répond `503` plutôt
 * que de s'ouvrir : savoir quels services sont configurés est un renseignement
 * utile à un attaquant — il dit où chercher, et surtout ce qui **n'est pas**
 * protégé.
 */

type Etat = "branchee" | "debranchee" | "partielle" | "sans-configuration";

const etat = (requiredEnv: readonly string[]): Etat => {
  if (requiredEnv.length === 0) {
    // Une capacité sans variable — design system, configuration TypeScript —
    // n'est ni branchée ni débranchée : la question ne se pose pas.
    return "sans-configuration";
  }

  const presentes = requiredEnv.filter((name) => {
    const valeur = process.env[name];

    // Une variable vide n'est pas une variable renseignée. Le dépôt le sait
    // déjà : une valeur `""` échoue la validation Zod (voir docs/SETUP.md).
    return typeof valeur === "string" && valeur.length > 0;
  }).length;

  if (presentes === 0) {
    return "debranchee";
  }

  return presentes === requiredEnv.length ? "branchee" : "partielle";
};

export const GET = (request: Request): Response => {
  const attendu = process.env.MANIFEST_TOKEN;

  if (!attendu) {
    return Response.json({ ok: false }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${attendu}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  return Response.json(
    {
      schemaVersion: 1,
      capabilities: CAPABILITY_ENV.map((capability) => ({
        id: capability.id,
        provider: capability.provider,
        criticality: capability.criticality,
        etat: etat(capability.requiredEnv),
        // Les noms suffisent au diagnostic : ils disent **quoi renseigner**.
        manquantes: capability.requiredEnv.filter((name) => !process.env[name]),
      })),
    },
    {
      // Un état d'exécution mis en cache ne décrit plus le moment présent.
      headers: { "cache-control": "no-store" },
    }
  );
};
