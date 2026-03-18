import {
  createClientFromEnv,
  createClient,
  type LmStudioClient,
} from "./lmstudio/index.js";
import { config } from "./config.js";

export const lmClient = createClientFromEnv();

export const orClient: LmStudioClient | null = config.OPENROUTER_API_KEY
  ? createClient({
      baseUrl: config.OPENROUTER_BASE_URL,
      apiKey: config.OPENROUTER_API_KEY,
      ...(config.OPENROUTER_APP_NAME
        ? { appName: config.OPENROUTER_APP_NAME }
        : {}),
    })
  : null;

export type Provider = "lmstudio" | "openrouter";

export const providers: Provider[] = [
  "lmstudio",
  ...(orClient ? (["openrouter"] as const) : []),
];

export function getClientForProvider(provider: string): LmStudioClient {
  if (provider === "openrouter") {
    if (!orClient) throw new Error("OpenRouter is not configured");
    return orClient;
  }
  return lmClient;
}
