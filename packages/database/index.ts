import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { keys } from "./keys";

// Motif standard du singleton Prisma : l'objet global n'est pas typé, la conversion
// est le seul moyen d'y attacher le client.
// nosemgrep: local-no-ts-suppression
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Pilote Postgres standard, partout — y compris sur Neon, qui accepte les
// connexions Postgres classiques (utiliser son point d'accès « pooler » en
// environnement serverless).
//
// La graine utilisait l'adaptateur serverless de Neon, qui parle un protocole
// WebSocket propre à Neon. Conséquence mesurée le 2026-08-05 : les migrations
// s'appliquaient sur le Postgres local et celui de la CI, mais **aucune requête
// applicative** ne pouvait aboutir. Invisible pendant des semaines — la seule
// page qui interroge la base exige une session Clerk et une organisation.
//
// Un seul chemin de code vaut mieux que deux : ce que la CI exerce est
// exactement ce qui tourne en production. Voir D-021.
const adapter = new PrismaPg({ connectionString: keys().DATABASE_URL });

export const database = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}

export * from "./generated/client";
