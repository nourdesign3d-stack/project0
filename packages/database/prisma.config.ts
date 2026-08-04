import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 ne charge plus les fichiers .env automatiquement lorsqu'un
// prisma.config.ts est présent : sans ceci, `prisma migrate` et `db push`
// échouent avec « Connection url is empty », même si .env.local est renseigné.
// Chemins relatifs à packages/database, où les scripts racine se placent.
loadEnv({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL ?? "";

if (!url) {
  throw new Error(
    "DATABASE_URL manquante. Renseigner packages/database/.env.local ou l'exporter dans l'environnement avant toute commande Prisma. Voir docs/DEPLOYMENT.md."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
