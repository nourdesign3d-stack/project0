import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright couvre uniquement quelques parcours critiques de bout en bout.
 * La pyramide de tests reste dans Vitest (`pnpm test`).
 *
 * Prérequis : une application démarrée et joignable.
 *  - par défaut : http://localhost:3000 (apps/app)
 *  - sinon : E2E_BASE_URL=https://…
 *
 * E2E_START_SERVER=true demande à Playwright de démarrer `pnpm dev --filter=app`
 * lui-même. Cela suppose un `.env.local` complet ; sans clés de service, démarrer
 * l'application manuellement.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const startServer = process.env.E2E_START_SERVER === "true";

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Artefacts de diagnostic uniquement en cas d'échec.
  // Ne jamais y inclure de secret : ni dans les URL, ni dans les champs saisis.
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: startServer
    ? {
        command: "pnpm dev --filter=app",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
