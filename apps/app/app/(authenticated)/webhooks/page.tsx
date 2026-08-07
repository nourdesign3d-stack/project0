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

  /**
   * Dégradation explicite plutôt qu'erreur serveur : dans l'installation par
   * défaut, aucun jeton Svix n'existe et `getAppPortal()` lève. La page
   * affichait alors une erreur — un service optionnel non configuré ne doit pas
   * casser la page qui le porte (D-051).
   */
  if (!webhooks.isConfigured()) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="font-semibold text-lg">Webhooks non configurés</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Renseigner <code>SVIX_TOKEN</code> pour activer le portail d'envoi.
            Voir <code>docs/DEPLOYMENT.md</code>.
          </p>
        </div>
      </div>
    );
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
