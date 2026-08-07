import { auth } from "@repo/auth/server";
import { webhooks } from "@repo/webhooks";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Webhooks",
  description: "Send webhooks to your users.",
};

const WebhooksPage = async () => {
  // Autoriser AVANT d'appeler le fournisseur : le layout parent redirige, mais
  // un layout n'est pas une autorisation — pages et layouts sont évalués en
  // parallèle. Sans ce contrôle, un appel anonyme déclenchait une requête vers
  // Svix avant toute redirection. Voir .claude/rules/security.md et D-033.
  const { orgId } = await auth();

  if (!orgId) {
    notFound();
  }

  const response = await webhooks.getAppPortal();

  if (!response?.url) {
    notFound();
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <iframe
        allow="clipboard-write"
        className="h-full w-full border-none"
        loading="lazy"
        src={response.url}
        title="Webhooks"
      />
    </div>
  );
};

export default WebhooksPage;
