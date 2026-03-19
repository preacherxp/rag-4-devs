import { z } from "zod";
import type { LmStudioClient, ChatMessage } from "./types.js";
import { chatCompletion, streamChat } from "./chat.js";
import { parseJsonWithRepair } from "./json.js";

export type StructuredChatOptions<T extends z.ZodType> = {
  model: string;
  messages: ChatMessage[];
  schema: T;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
};

export async function structuredChat<T extends z.ZodType>(
  client: LmStudioClient,
  options: StructuredChatOptions<T>,
): Promise<z.infer<T>> {
  const text = await chatCompletion(client, {
    model: options.model,
    messages: options.messages,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "response",
        strict: true,
        schema: z.toJSONSchema(options.schema) as Record<string, unknown>,
      },
    },
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  const parsed = parseJsonWithRepair(text);
  return options.schema.parse(parsed) as z.infer<T>;
}

export async function structuredStreamChat<T extends z.ZodType>(
  client: LmStudioClient,
  options: StructuredChatOptions<T> & {
    onToken?: (token: string) => void;
    signal?: AbortSignal;
    onStreamComplete?: () => void | Promise<void>;
  },
): Promise<z.infer<T>> {
  let buffer = "";
  for await (const token of streamChat(client, {
    model: options.model,
    messages: options.messages,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "response",
        strict: true,
        schema: z.toJSONSchema(options.schema) as Record<string, unknown>,
      },
    },
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    signal: options.signal,
  })) {
    options.onToken?.(token);
    buffer += token;
  }

  if (options.onStreamComplete) {
    await Promise.resolve(options.onStreamComplete());
  }
  const parsed = parseJsonWithRepair(buffer);
  return options.schema.parse(parsed) as z.infer<T>;
}
