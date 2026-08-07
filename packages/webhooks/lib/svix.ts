import "server-only";
import { auth } from "@repo/auth/server";
import { Svix } from "svix";
import { keys } from "../keys";

const svixToken = keys().SVIX_TOKEN;

/**
 * Le fournisseur de webhooks est-il configuré ?
 *
 * ⚠️ `getAppPortal()` **lève** quand `SVIX_TOKEN` est absent, et rien ne
 * rattrapait cette exception : dans l'installation par défaut — celle de tout
 * projet dérivé de la graine, où aucun jeton Svix n'existe — ouvrir la page
 * `/webhooks` produisait une erreur serveur. Une fonctionnalité non configurée
 * doit se **dégrader**, pas casser la page qui la porte. Relevé en audit le
 * 2026-08-07 (D-051).
 *
 * `send()` continue de lever, et c'est voulu : un envoi silencieusement ignoré
 * serait pire qu'un échec. La distinction est entre « afficher » et « agir ».
 */
export const isConfigured = (): boolean => Boolean(svixToken);

export const send = async (eventType: string, payload: object) => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const { orgId } = await auth();

  if (!orgId) {
    return;
  }

  return svix.message.create(orgId, {
    eventType,
    payload: {
      eventType,
      ...payload,
    },
    application: {
      name: orgId,
      uid: orgId,
    },
  });
};

export const getAppPortal = async () => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const { orgId } = await auth();

  if (!orgId) {
    return;
  }

  return svix.authentication.appPortalAccess(orgId, {
    application: {
      name: orgId,
      uid: orgId,
    },
  });
};
