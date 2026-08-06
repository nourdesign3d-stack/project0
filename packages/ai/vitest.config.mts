import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Aucun composant n'est rendu ici : `jsdom` définirait `window` et la
    // validation d'environnement refuserait alors les variables serveur.
    environment: "node",
  },
});
