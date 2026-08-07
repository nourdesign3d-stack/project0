import { auth } from "@repo/auth/server";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { AvatarStack } from "./components/avatar-stack";
import { Cursors } from "./components/cursors";
import { Header } from "./components/header";

const title = "Acme Inc";
const description = "My application.";

const CollaborationProvider = dynamic(() =>
  import("./components/collaboration-provider").then(
    (mod) => mod.CollaborationProvider
  )
);

export const metadata: Metadata = {
  title,
  description,
};

const App = async () => {
  // Autoriser AVANT de lire : le layout parent redirige, mais un layout n'est
  // pas une autorisation au niveau de l'accès aux données, et pages et layouts
  // peuvent être évalués en parallèle. Voir .claude/rules/security.md.
  const { orgId } = await auth();

  if (!orgId) {
    notFound();
  }

  /**
   * ⚠️ Cette page interrogeait `Page`, le modèle de **démonstration** du gabarit,
   * retiré le 2026-08-07 (D-070). Une graine qui livre une table de démonstration
   * la fait supprimer par chaque projet dérivé — et en attendant, sa page
   * d'accueil affiche des données qui n'existent pas.
   *
   * Ce qui reste est délibérément vide : c'est l'emplacement du produit, et la
   * graine n'a pas à décider ce qui s'y trouve.
   *
   * ⚠️ **Quand une entité scopée arrivera ici**, sa requête devra porter le
   * filtre de tenant **dans le `where`** — invariant INV-001,
   * `.claude/rules/security.md`. La règle Semgrep `local-tenant-filter-required`
   * le fait respecter ; elle n'a rien à signaler tant qu'aucune requête n'existe.
   */

  return (
    <>
      <Header page="Data Fetching" pages={["Building Your Application"]}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider orgId={orgId}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  );
};

export default App;
