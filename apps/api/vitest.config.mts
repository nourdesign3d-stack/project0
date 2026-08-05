import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // `apps/api` ne rend aucun composant : sous `jsdom`, `window` existe et la
    // validation d'environnement refuse alors toute variable serveur, croyant
    // s'exécuter côté client.
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
      "@repo": path.resolve(import.meta.dirname, "../../packages"),
      // Voir __tests__/stubs/server-only.ts : sans cela, un package serveur ne
      // peut être chargé en test que simulé — donc pas éprouvé.
      "server-only": path.resolve(
        import.meta.dirname,
        "./__tests__/stubs/server-only.ts"
      ),
    },
  },
});
