import { analytics } from "@repo/analytics/server";
import type {
  DeletedObjectJSON,
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
  WebhookEvent,
} from "@repo/auth/server";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { env } from "@/env";
import { claimEvent, releaseEvent } from "@/lib/idempotency";

const PROVIDER = "clerk";

const handleUserCreated = (data: UserJSON) => {
  analytics?.identify({
    distinctId: data.id,
    properties: {
      email: data.email_addresses.at(0)?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      createdAt: new Date(data.created_at),
      avatar: data.image_url,
      phoneNumber: data.phone_numbers.at(0)?.phone_number,
    },
  });

  analytics?.capture({
    event: "User Created",
    distinctId: data.id,
  });

  return new Response("User created", { status: 201 });
};

const handleUserUpdated = (data: UserJSON) => {
  analytics?.identify({
    distinctId: data.id,
    properties: {
      email: data.email_addresses.at(0)?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      createdAt: new Date(data.created_at),
      avatar: data.image_url,
      phoneNumber: data.phone_numbers.at(0)?.phone_number,
    },
  });

  analytics?.capture({
    event: "User Updated",
    distinctId: data.id,
  });

  return new Response("User updated", { status: 201 });
};

const handleUserDeleted = (data: DeletedObjectJSON) => {
  if (data.id) {
    analytics?.identify({
      distinctId: data.id,
      properties: {
        deleted: new Date(),
      },
    });

    analytics?.capture({
      event: "User Deleted",
      distinctId: data.id,
    });
  }

  return new Response("User deleted", { status: 201 });
};

const handleOrganizationCreated = (data: OrganizationJSON) => {
  analytics?.groupIdentify({
    groupKey: data.id,
    groupType: "company",
    distinctId: data.created_by,
    properties: {
      name: data.name,
      avatar: data.image_url,
    },
  });

  if (data.created_by) {
    analytics?.capture({
      event: "Organization Created",
      distinctId: data.created_by,
    });
  }

  return new Response("Organization created", { status: 201 });
};

const handleOrganizationUpdated = (data: OrganizationJSON) => {
  analytics?.groupIdentify({
    groupKey: data.id,
    groupType: "company",
    distinctId: data.created_by,
    properties: {
      name: data.name,
      avatar: data.image_url,
    },
  });

  if (data.created_by) {
    analytics?.capture({
      event: "Organization Updated",
      distinctId: data.created_by,
    });
  }

  return new Response("Organization updated", { status: 201 });
};

const handleOrganizationMembershipCreated = (
  data: OrganizationMembershipJSON
) => {
  analytics?.groupIdentify({
    groupKey: data.organization.id,
    groupType: "company",
    distinctId: data.public_user_data.user_id,
  });

  analytics?.capture({
    event: "Organization Member Created",
    distinctId: data.public_user_data.user_id,
  });

  return new Response("Organization membership created", { status: 201 });
};

const handleOrganizationMembershipDeleted = (
  data: OrganizationMembershipJSON
) => {
  // Need to unlink the user from the group

  analytics?.capture({
    event: "Organization Member Deleted",
    distinctId: data.public_user_data.user_id,
  });

  return new Response("Organization membership deleted", { status: 201 });
};

export const POST = async (request: Request): Promise<Response> => {
  // 503 et non 2xx : un 2xx dit au fournisseur « reçu et traité ». Sans clé,
  // rien n'est traité — l'événement serait perdu sans trace chez Clerk.
  if (!env.CLERK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!(svixId && svixTimestamp && svixSignature)) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Corps brut : la signature Svix porte sur les octets reçus. Passer par
  // request.json() puis JSON.stringify() re-sérialise le corps et peut faire
  // échouer une signature pourtant valide (ordre des clés, espaces, unicode).
  const body = await request.text();

  // Create a new SVIX instance with your secret.
  const webhook = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let event: WebhookEvent | undefined;

  // Verify the payload with the headers
  try {
    event = webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    log.error("Error verifying webhook:", { error });
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = event.data;
  const eventType = event.type;

  // Ne jamais journaliser le corps : il contient e-mail, nom, téléphone et
  // l'ensemble des attributs de l'utilisateur. En production, `log` écrit vers
  // un service tiers (BetterStack). Voir .claude/rules/security.md.
  log.info("Webhook", { id, eventType });

  // Réserver avant de traiter (R-012). La clé est `svix-id`, identifiant de
  // **livraison** : Svix conserve le même d'un réessai à l'autre, alors que
  // l'identifiant de la ressource (`event.data.id`) est partagé par tous les
  // événements qui la concernent — l'utiliser confondrait une création et une
  // mise à jour du même utilisateur.
  let claimed: boolean;

  try {
    claimed = await claimEvent(PROVIDER, svixId);
  } catch (error) {
    log.error("Webhook : réservation impossible", { id, eventType, error });

    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (!claimed) {
    log.info("Webhook : événement déjà traité", { id, eventType });

    return NextResponse.json({ ok: true, duplicate: true });
  }

  let response: Response = new Response("", { status: 201 });

  try {
    switch (eventType) {
      case "user.created": {
        response = handleUserCreated(event.data);
        break;
      }
      case "user.updated": {
        response = handleUserUpdated(event.data);
        break;
      }
      case "user.deleted": {
        response = handleUserDeleted(event.data);
        break;
      }
      case "organization.created": {
        response = handleOrganizationCreated(event.data);
        break;
      }
      case "organization.updated": {
        response = handleOrganizationUpdated(event.data);
        break;
      }
      case "organizationMembership.created": {
        response = handleOrganizationMembershipCreated(event.data);
        break;
      }
      case "organizationMembership.deleted": {
        response = handleOrganizationMembershipDeleted(event.data);
        break;
      }
      default: {
        break;
      }
    }

    await analytics?.shutdown();
  } catch (error) {
    // Libérer, sinon le réessai de Clerk serait pris pour un doublon et
    // l'événement serait perdu en silence.
    await releaseEvent(PROVIDER, svixId);

    log.error("Webhook : traitement en échec", { id, eventType, error });

    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return response;
};
