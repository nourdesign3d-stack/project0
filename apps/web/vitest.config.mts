import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * `apps/web` n'avait **aucun test** : ses protections — validation du formulaire
 * de contact, limitation de débit, discrétion des messages d'erreur — n'étaient
 * gardées par rien, et pouvaient être défaites sans que la chaîne rougisse.
 * Relevé en audit le 2026-08-07 (T-1401).
 *
 * Calqué sur `apps/api/vitest.config.mts`, pour la même raison : sous `jsdom`,
 * `window` existe et la validation d'environnement refuse toute variable serveur,
 * croyant s'exécuter côté client.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
      "@repo": path.resolve(import.meta.dirname, "../../packages"),
      "server-only": path.resolve(
        import.meta.dirname,
        "./__tests__/stubs/server-only.ts"
      ),
    },
  },
});
