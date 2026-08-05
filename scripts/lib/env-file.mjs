/**
 * Manipulation d'un fichier `.env.local` — la partie de `set-env.mjs` qui écrit
 * réellement, isolée pour être testable. Le reste du script exige un terminal
 * (saisie masquée) et ne peut donc pas s'éprouver en test.
 */

/**
 * Une déclaration, active ou commentée. `setup-env.mjs` commente les variables
 * sans valeur : ce sont précisément celles que l'on vient renseigner.
 *
 * Le drapeau `g` est essentiel. `dotenv` retient la **dernière** définition d'une
 * variable : ne remplacer que la première laisserait une déclaration périmée
 * plus bas dans le fichier, qui écraserait silencieusement la valeur écrite.
 */
export const declaration = (key) => new RegExp(`^(#\\s*)?${key}\\s*=.*$`, "gm");

export const declares = (content, key) => declaration(key).test(content);

/**
 * Guillemets systématiques : une chaîne de connexion contient `&` et `?`, que
 * certains outils interprètent si la valeur n'est pas protégée.
 */
export const withValue = (content, key, value) =>
  content.replace(declaration(key), `${key}="${value}"`);

/**
 * Lit une valeur **active** (non commentée). Volontairement minimal : de quoi
 * lire une `DATABASE_URL`, sans ajouter `dotenv` à la racine du dépôt pour cela.
 *
 * `dotenv` retenant la dernière définition, on fait de même.
 */
const SURROUNDING_QUOTES = /^(["'])(.*)\1$/;

export const readValue = (content, key) => {
  const matches = content.match(new RegExp(`^${key}\\s*=(.*)$`, "gm"));

  if (!matches) {
    return "";
  }

  const raw = matches.at(-1).split("=").slice(1).join("=").trim();

  return raw.replace(SURROUNDING_QUOTES, "$2");
};
