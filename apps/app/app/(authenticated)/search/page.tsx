import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
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

  // TODO(domaine) : ajouter le filtre de tenant (`orgId`) dès que `Page`
  // devient une entité métier — invariant INV-001.
  const pages = await database.page.findMany({
    where: {
      name: {
        contains: query.data,
      },
    },
    take: 50,
  });

  return (
    <>
      <Header page="Search" pages={["Building Your Application"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          {pages.map((page) => (
            <div className="aspect-video rounded-xl bg-muted/50" key={page.id}>
              {page.name}
            </div>
          ))}
        </div>
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  );
};

export default SearchPage;
