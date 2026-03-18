import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { config, DEFAULT_CHAT_MODEL, DEFAULT_CHAT_PROVIDER } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const schemaPath = resolve(__dirname, "schema.sql");
  let sql = readFileSync(schemaPath, "utf-8");
  const defaultChatModel = DEFAULT_CHAT_MODEL.replace(/'/g, "''");
  const defaultChatProvider = DEFAULT_CHAT_PROVIDER.replace(/'/g, "''");

  // Replace dimension placeholder
  sql = sql.replaceAll("{dimension}", String(config.EMBED_DIMENSION));

  await pool.query(sql);

  await pool.query(`
    ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS model TEXT
  `);

  await pool.query(`
    UPDATE chat_sessions
    SET model = '${defaultChatModel}'
    WHERE model IS NULL OR btrim(model) = ''
  `);

  await pool.query(`
    ALTER TABLE chat_sessions
    ALTER COLUMN model SET NOT NULL
  `);

  await pool.query(`
    ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '${defaultChatProvider}'
  `);

  await pool.query(`
    ALTER TABLE chat_sessions
    ALTER COLUMN provider SET DEFAULT '${defaultChatProvider}'
  `);

  // Create HNSW index if it doesn't exist
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING hnsw (embedding vector_cosine_ops)
  `);

  console.log("[migrate] Schema ready");
}
