import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { chunkMarkdown } from "./chunker.js";
import { embedBatch } from "../lmstudio/index.js";
import { getClientForProvider } from "../llm.js";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function toSqlVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Index a single markdown file. Returns true if it was re-indexed. */
async function indexFile(filePath: string, content: string): Promise<boolean> {
  const checksum = sha256(content);

  // Check if already indexed with same checksum
  const existing = await pool.query(
    "SELECT id, checksum FROM documents WHERE file_path = $1",
    [filePath],
  );

  if (existing.rows[0]?.checksum === checksum) {
    return false;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert document
    const docResult = await client.query(
      `INSERT INTO documents (file_path, checksum, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (file_path) DO UPDATE SET checksum = $2, updated_at = now()
       RETURNING id`,
      [filePath, checksum],
    );
    const docId = docResult.rows[0].id as number;

    // Delete old chunks
    await client.query("DELETE FROM chunks WHERE document_id = $1", [docId]);

    // Chunk the document
    const chunks = chunkMarkdown(content);
    if (chunks.length === 0) {
      await client.query("COMMIT");
      return true;
    }

    // Embed all chunks
    const texts = chunks.map((c) => c.content);
    console.log(`[ingest] Embedding ${texts.length} chunks for ${filePath}`);
    const embedClient = getClientForProvider(config.EMBED_PROVIDER);
    const embeddings = await embedBatch(embedClient, config.EMBED_MODEL, texts);

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i]!;
      await client.query(
        `INSERT INTO chunks (document_id, chunk_index, heading, content, embedding)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          docId,
          chunk.chunkIndex,
          chunk.heading,
          chunk.content,
          toSqlVector(embedding),
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`[ingest] Indexed ${filePath}: ${chunks.length} chunks`);
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Scan the RAG directory and index all markdown files. */
export async function indexAll(): Promise<{
  indexed: number;
  skipped: number;
}> {
  const ragDir = resolve(config.RAG_DIR);
  console.log(ragDir);
  const files = readdirSync(ragDir).filter((f) => f.endsWith(".md"));

  let indexed = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = resolve(ragDir, file);
    const content = readFileSync(filePath, "utf-8");
    const wasIndexed = await indexFile(filePath, content);
    if (wasIndexed) indexed++;
    else skipped++;
  }

  console.log(`[ingest] Done: ${indexed} indexed, ${skipped} unchanged`);
  return { indexed, skipped };
}

/** Re-index a single file by path. */
export async function indexSingleFile(filePath: string): Promise<void> {
  const content = readFileSync(filePath, "utf-8");
  await indexFile(filePath, content);
}

/** Remove a document and its chunks by file path. */
export async function removeFile(filePath: string): Promise<void> {
  await pool.query("DELETE FROM documents WHERE file_path = $1", [filePath]);
  console.log(`[ingest] Removed ${filePath}`);
}
