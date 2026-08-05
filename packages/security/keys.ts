import { createEnv } from "@t3-oss/env-nextjs";

// Plus aucune variable : la protection Arcjet a été retirée (D-014).
// Le fichier est conservé pour que le contrat du package reste stable si une
// variable de sécurité réapparaît.
export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {},
    runtimeEnv: {},
  });
