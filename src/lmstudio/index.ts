export type {
  LmStudioConfig,
  LmStudioClient,
  ChatMessage,
  ChatOptions,
  AvailableModel,
} from "./types.js";

export { createClient, createClientFromEnv } from "./client.js";
export { chatCompletion, streamChat, streamChatToString, listChatModels } from "./chat.js";
export { embed, embedBatch } from "./embeddings.js";
export { stripJsonMarkdownFences, repairTruncatedJsonArray, parseJsonWithRepair } from "./json.js";
export type { StructuredChatOptions } from "./structured.js";
export { structuredChat, structuredStreamChat } from "./structured.js";
