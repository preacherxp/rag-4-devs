export type LmStudioConfig = {
  baseUrl: string;
  apiKey?: string | undefined;
};

export type LmStudioClient = {
  baseUrl: string;
  headers: Record<string, string>;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  responseFormat?:
    | { type: "text" }
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: { name: string; strict?: boolean; schema: Record<string, unknown> } }
    | undefined;
  stop?: string[] | undefined;
  signal?: AbortSignal | undefined;
};

export type AvailableModel = {
  id: string;
  object: string;
  ownedBy: string;
};
