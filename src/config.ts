import "dotenv/config";
import { z } from "zod";

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-nano";

const envSchema = z.object({
  EMBED_MODEL: z.string().default("nomic-embed-text"),
  EMBED_DIMENSION: z.coerce.number().int().default(768),
  EMBED_PROVIDER: z.enum(["lmstudio", "openrouter"]).default("lmstudio"),
  DATABASE_URL: z.string().default("postgresql://rag:rag@localhost:5433/rag"),
  RAG_DIR: z.string().default("../../../../rag"),
  PORT: z.coerce.number().int().default(4138),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_NAME: z.string().optional(),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
