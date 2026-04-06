import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { structuredChat, StructuredChatError } from "./structured.js";
import type { LmStudioClient } from "./types.js";

const client: LmStudioClient = {
  baseUrl: "http://example.test",
  headers: { "content-type": "application/json" },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("structuredChat", () => {
  test("wraps JSON parsing failures with the raw model response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "not valid json" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    try {
      await structuredChat(client, {
        model: "test-model",
        messages: [{ role: "user", content: "hi" }],
        schema: z.object({ ok: z.boolean() }),
      });
      throw new Error("expected structuredChat to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredChatError);
      expect((error as StructuredChatError).stage).toBe("parse");
      expect((error as StructuredChatError).rawText).toBe("not valid json");
    }
  });

  test("wraps schema validation failures with the raw model response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":"nope"}' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    try {
      await structuredChat(client, {
        model: "test-model",
        messages: [{ role: "user", content: "hi" }],
        schema: z.object({ ok: z.boolean() }),
      });
      throw new Error("expected structuredChat to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredChatError);
      expect((error as StructuredChatError).stage).toBe("schema");
      expect((error as StructuredChatError).rawText).toBe('{"ok":"nope"}');
    }
  });
});
