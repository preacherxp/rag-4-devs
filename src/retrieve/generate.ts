import { getRecentMessages } from "../chat/store.js";
import { streamChat, type ChatMessage } from "../lmstudio/index.js";
import { DEFAULT_CHAT_PROVIDER } from "../config.js";
import { getClientForProvider } from "../llm.js";
import { searchChunks, type SearchResult } from "./search.js";
import { assembleContext, sourceLabel } from "./context.js";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context documents.

Rules:
- Answer based on the context provided. If the context doesn't contain relevant information, say so.
- Cite sources using their label attribute from the <source> tags in square brackets, e.g. [s01e01-programowanie-interakcji]. Do NOT use numbered references like [1], [2], [3] — always use the actual label.
- Match the language of the user's question (if they ask in Polish, respond in Polish).
- Use proper markdown formatting: **bold** for emphasis, bullet lists (- item), numbered lists, headers (##), and code blocks where appropriate.
- Preserve the structure of the source material when it makes sense (e.g. if the source has a list, keep it as a list).
- Be concise and direct.
- Do not output special tokens or control sequences.`;

export type SourceMeta = {
  label: string;
  heading: string;
  similarity: number;
  filePath: string;
};

const HISTORY_WINDOW = 12;

function buildSourcesMeta(results: SearchResult[]): SourceMeta[] {
  return results.map((r) => ({
    label: sourceLabel(r.filePath),
    heading: r.heading,
    similarity: r.similarity,
    filePath: r.filePath,
  }));
}

/**
 * Run the full RAG pipeline: search → context → stream LLM response.
 * Yields token strings as they arrive, then a final sources block.
 */
export async function* ragStream(
  query: string,
  sessionId: string,
  model: string,
  historyBeforeSequence?: number,
  provider = DEFAULT_CHAT_PROVIDER,
  focusDocumentId?: number,
): AsyncGenerator<{ type: "token"; data: string } | { type: "sources"; data: SourceMeta[] }> {
  const results = await searchChunks(query, 5, 0.3, focusDocumentId);
  const context = assembleContext(results);
  const history = await getRecentMessages(
    sessionId,
    HISTORY_WINDOW,
    historyBeforeSequence,
  );

  const messages: ChatMessage[] = [
    { role: "system" as const, content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...history,
    { role: "user" as const, content: query },
  ];

  const client = getClientForProvider(provider);
  for await (const token of streamChat(client, { model, messages, temperature: 0.3, maxTokens: 4096 })) {
    yield { type: "token", data: token };
  }

  if (results.length > 0) {
    yield { type: "sources", data: buildSourcesMeta(results) };
  }
}
