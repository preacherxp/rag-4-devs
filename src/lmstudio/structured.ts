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

export class StructuredChatError extends Error {
  readonly stage: "parse" | "schema";
  readonly rawText: string;

  constructor(
    stage: "parse" | "schema",
    message: string,
    rawText: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "StructuredChatError";
    this.stage = stage;
    this.rawText = rawText;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function parseStructuredResponse<T extends z.ZodType>(rawText: string, schema: T): z.infer<T> {
  let parsed: unknown;
  try {
    parsed = parseJsonWithRepair(rawText);
  } catch (error) {
    throw new StructuredChatError("parse", "Failed to parse structured model response", rawText, {
      cause: error,
    });
  }

  try {
    return schema.parse(parsed) as z.infer<T>;
  } catch (error) {
    throw new StructuredChatError(
      "schema",
      "Structured model response did not match the expected schema",
      rawText,
      { cause: error },
    );
  }
}

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

  return parseStructuredResponse(text, options.schema);
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
  return parseStructuredResponse(buffer, options.schema);
}
