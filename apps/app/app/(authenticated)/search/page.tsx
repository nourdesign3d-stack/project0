import { auth } from "@repo/auth/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Header } from "../components/header";

// `searchParams` vient du client : borné et normalisé avant d'atteindre la base.
const SEARCH_QUERY = z.string().trim().min(1).max(100);

interface SearchPageProperties {
  searchParams: Promise<{
    q: string;
  }>;
}

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties) => {
  const { q } = await searchParams;

  return {
    title: `${q} - Search results`,
    description: `Search results for ${q}`,
  };
};

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  // Autoriser, puis valider l'entrée, puis seulement interroger la base.
  // Voir .claude/rules/security.md.
  const { orgId } = await auth();

  if (!orgId) {
    notFound();
  }

  const { q } = await searchParams;
  const query = SEARCH_QUERY.safeParse(q);

  if (!query.success) {
    redirect("/");
  }

  /**
   * ⚠️ Cette page cherchait dans `Page`, le modèle de **démonstration** retiré le
   * 2026-08-07 (D-070). La validation de la requête est conservée : c'est la
   * partie réutilisable, et la recherche est typiquement la première route
   * coûteuse qu'un produit expose (R-003).
   *
   * ⚠️ **La requête à écrire ici devra porter le filtre de tenant dans le
   * `where`**, jamais en post-filtrage — invariant INV-001. Une recherche sans
   * filtre est la fuite inter-organisation la plus banale : elle ne ressemble
   * pas à une faille, elle ressemble à une recherche. La règle Semgrep
   * `local-tenant-filter-required` la refuse.
   */

  return (
    <>
      <Header page="Search" pages={["Building Your Application"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <p className="text-muted-foreground text-sm">
          Recherche de « {query.data} » — aucun modèle à interroger tant que le
          produit n'en définit pas.
        </p>
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  );
};

export default SearchPage;
