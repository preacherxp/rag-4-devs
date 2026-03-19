import type { LmStudioClient, ChatOptions, AvailableModel } from "./types.js";

type StreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
};

type ModelsResponse = {
  data?: Array<{ id: string; object?: string; owned_by?: string }>;
};

export async function chatCompletion(
  client: LmStudioClient,
  options: ChatOptions,
): Promise<string> {
  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: client.headers,
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: false,
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
      ...(options.maxTokens !== undefined
        ? { max_tokens: options.maxTokens }
        : {}),
      ...(options.responseFormat
        ? { response_format: options.responseFormat }
        : {}),
      ...(options.stop ? { stop: options.stop } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LMStudio chat failed (${res.status}): ${detail}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LMStudio returned an empty response.");
  }
  return content;
}

export async function* streamChat(
  client: LmStudioClient,
  options: ChatOptions,
): AsyncGenerator<string> {
  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: client.headers,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
      ...(options.maxTokens !== undefined
        ? { max_tokens: options.maxTokens }
        : {}),
      ...(options.responseFormat
        ? { response_format: options.responseFormat }
        : {}),
      ...(options.stop ? { stop: options.stop } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LMStudio chat failed (${res.status}): ${detail}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokenBuf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        if (tokenBuf) {
          const flushed = tokenBuf.replace(/<\|[^|]*\|>/g, "");
          if (flushed) yield flushed;
        }
        return;
      }

      const chunk = JSON.parse(data) as StreamChunk;
      const raw = chunk.choices?.[0]?.delta?.content;
      if (raw) {
        tokenBuf += raw;
        // Hold back if buffer ends with a partial special token sequence
        if (/<\|[^>]*$/.test(tokenBuf)) continue;
        const content = tokenBuf.replace(/<\|[^|]*\|>/g, "");
        tokenBuf = "";
        if (content) yield content;
      }
    }
  }

  // Flush any remaining buffered content
  if (tokenBuf) {
    const flushed = tokenBuf.replace(/<\|[^|]*\|>/g, "");
    if (flushed) yield flushed;
  }
}

export async function streamChatToString(
  client: LmStudioClient,
  options: ChatOptions,
): Promise<string> {
  let result = "";
  for await (const token of streamChat(client, options)) {
    result += token;
  }
  return result;
}

export async function listChatModels(
  client: LmStudioClient,
): Promise<AvailableModel[]> {
  const res = await fetch(`${client.baseUrl}/models`, {
    method: "GET",
    headers: client.headers,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LMStudio models failed (${res.status}): ${detail}`);
  }

  const payload = (await res.json()) as ModelsResponse;
  const models = payload.data ?? [];

  return models
    .filter((m) => typeof m.id === "string" && m.id.length > 0)
    .map((m) => ({
      id: m.id,
      object: m.object ?? "model",
      ownedBy: m.owned_by ?? "lmstudio",
    }));
}
