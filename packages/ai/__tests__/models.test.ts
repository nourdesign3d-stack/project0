import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Ce package n'a jamais été exécuté. Il compile — et « ça compile » ne veut rien
 * dire : la dérive de l'AI SDK v6 avait déjà cassé son API sans qu'aucun
 * contrôle ne le signale, et la correction (D-004) a été écrite à l'aveugle,
 * faute de clé OpenAI.
 *
 * Ce test ferme cet angle mort **sans compte, sans clé et sans coût** : un
 * serveur local compatible OpenAI reçoit l'appel. `createOpenAI` se rabat sur
 * `OPENAI_BASE_URL` quand aucune URL n'est passée, ce que fait `lib/models.ts`.
 *
 * Ce qu'il prouve : le module se charge, construit un modèle, émet une requête
 * conforme et sait lire la réponse.
 * Ce qu'il ne prouve pas : qu'OpenAI accepte cet appel. Comme pour BetterStack,
 * on constate ce qui part et sa forme, pas ce que le fournisseur en fait.
 */

interface RecordedRequest {
  readonly authorization: string;
  readonly body: string;
  readonly url: string;
}

/** Défini hors des fonctions : une expression régulière recréée à chaque appel coûte. */
const VERSIONED_PATH = /^\/v1\//;

const received: RecordedRequest[] = [];
let server: Server;

const completion = {
  id: "chatcmpl-local",
  object: "chat.completion",
  created: 1_700_000_000,
  model: "gpt-4o-mini",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "réponse locale" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
};

const responsesApi = {
  id: "resp_local",
  object: "response",
  created_at: 1_700_000_000,
  model: "gpt-4o-mini",
  status: "completed",
  output: [
    {
      id: "msg_local",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [
        { type: "output_text", text: "réponse locale", annotations: [] },
      ],
    },
  ],
  usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
};

beforeAll(async () => {
  server = createServer((request, result) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        authorization: request.headers.authorization ?? "",
        url: request.url ?? "",
        body: Buffer.concat(chunks).toString("utf8"),
      });

      result.writeHead(200, { "content-type": "application/json" });
      result.end(
        JSON.stringify(
          request.url?.includes("responses") ? responsesApi : completion
        )
      );
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;

  // Renseignées **avant** l'import : `lib/models.ts` construit le fournisseur
  // au chargement du module, pas à l'appel.
  process.env.OPENAI_API_KEY = "sk-local-pour-les-tests";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe("@repo/ai", () => {
  test("produit du texte contre un point d'accès compatible OpenAI", async () => {
    const { generateText } = await import("ai");
    const { models } = await import("../lib/models");

    const result = await generateText({
      model: models.chat,
      prompt: "Dis bonjour.",
    });

    expect(result.text).toBe("réponse locale");
  });

  test("adresse le modèle déclaré, sur le point d'accès attendu", () => {
    // Sans cela, le test passerait même si le module interrogeait un autre
    // modèle que celui qu'il annonce.
    const last = received.at(-1);

    expect(last, "aucune requête reçue").toBeDefined();
    expect(last?.url).toMatch(VERSIONED_PATH);
    expect(last?.body).toContain("gpt-4o-mini");
  });

  test("transmet la clé d'API en en-tête", () => {
    // Une clé non transmise passerait inaperçue face à un serveur local
    // permissif, et n'échouerait qu'en production, sur un 401.
    const last = received.at(-1);

    expect(last?.authorization).toBe("Bearer sk-local-pour-les-tests");
  });
});
