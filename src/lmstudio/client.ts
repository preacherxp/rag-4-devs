import type { LmStudioConfig, LmStudioClient } from "./types.js";

export function createClient(config: LmStudioConfig): LmStudioClient {
  const base = config.baseUrl.replace(/\/+$/, "");
  const baseUrl = base.endsWith("/v1") ? base : `${base}/v1`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return { baseUrl, headers };
}

export function createClientFromEnv(): LmStudioClient {
  return createClient({
    baseUrl: process.env.LMSTUDIO_BASE_URL ?? "http://127.0.0.1:1234",
    apiKey: process.env.LMSTUDIO_API_KEY || undefined,
  });
}
