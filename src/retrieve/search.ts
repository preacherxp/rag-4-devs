import { pool } from "../db/pool.js";
import { embed } from "../lmstudio/index.js";
import { getClientForProvider } from "../llm.js";
import { config } from "../config.js";

export type SearchResult = {
  chunkId: number;
  heading: string;
  content: string;
  similarity: number;
  filePath: string;
};

/**
 * Find the top-K most similar chunks to a query.
 * Uses cosine similarity via pgvector's <=> operator.
 */
export async function searchChunks(
  query: string,
  topK = 5,
  threshold = 0.3,
  documentId?: number,
): Promise<SearchResult[]> {
  const embedClient = getClientForProvider(config.EMBED_PROVIDER);
  const queryVec = await embed(embedClient, config.EMBED_MODEL, query);
  const vecStr = `[${queryVec.join(",")}]`;

  const params: unknown[] = [vecStr, threshold, topK];
  let docFilter = "";
  if (documentId != null) {
    docFilter = ` AND c.document_id = $${params.length + 1}`;
    params.push(documentId);
  }

  const result = await pool.query(
    `SELECT
       c.id AS chunk_id,
       c.heading,
       c.content,
       1 - (c.embedding <=> $1::vector) AS similarity,
       d.file_path
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE 1 - (c.embedding <=> $1::vector) >= $2${docFilter}
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    params,
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    chunkId: row.chunk_id as number,
    heading: (row.heading as string) || "",
    content: row.content as string,
    similarity: parseFloat(row.similarity as string),
    filePath: row.file_path as string,
  }));
}
