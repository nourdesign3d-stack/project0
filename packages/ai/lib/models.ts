import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";
import { keys } from "../keys";

const openai = createOpenAI({
  apiKey: keys().OPENAI_API_KEY,
});

// Explicit annotations: the inferred provider types are not portable
// across the pnpm store (TS2742).
export const models: {
  chat: LanguageModel;
  embeddings: EmbeddingModel;
} = {
  chat: openai("gpt-4o-mini"),
  embeddings: openai.textEmbeddingModel("text-embedding-3-small"),
};
