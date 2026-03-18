import type { LmStudioClient } from "./types.js";

type EmbeddingResponse = {
  data: Array<{ embedding: number[] }>;
};

/** Embed a batch of texts. Returns one embedding per input text. */
export async function embedBatch(
  client: LmStudioClient,
  model: string,
  texts: string[],
  batchSize = 32,
): Promise<number[][]> {
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch(`${client.baseUrl}/embeddings`, {
      method: "POST",
      headers: client.headers,
      body: JSON.stringify({ model, input: batch }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Embedding request failed (${res.status}): ${detail}`);
    }

    const payload = (await res.json()) as EmbeddingResponse;
    for (const item of payload.data) {
      all.push(item.embedding);
    }
  }

  return all;
}

/** Embed a single text. */
export async function embed(
  client: LmStudioClient,
  model: string,
  text: string,
): Promise<number[]> {
  const [vec] = await embedBatch(client, model, [text], 1);
  return vec!;
}
