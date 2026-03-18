import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config, DEFAULT_CHAT_MODEL, DEFAULT_CHAT_PROVIDER } from "./config.js";
import {
  appendMessage,
  createSession,
  deleteSession,
  getLatestSession,
  getSession,
  listSessions,
  updateSessionModel,
} from "./chat/store.js";
import { pool } from "./db/pool.js";
import {
  deleteDocument,
  getDocumentPreview,
  listDocuments,
} from "./documents/store.js";
import { listChatModels } from "./lmstudio/index.js";
import { lmClient, orClient, providers } from "./llm.js";
import { ragStream } from "./retrieve/generate.js";
import { indexAll } from "./ingest/pipeline.js";
import {
  createQuiz as createQuizInDb,
  getQuiz,
  listQuizzes,
  deleteQuiz,
  answerQuestion,
  restartQuiz,
  completeQuiz,
} from "./quiz/store.js";
import { generateQuiz } from "./quiz/generate.js";
const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = new Hono();

// Chat endpoint with SSE streaming
app.post("/api/chat", async (c) => {
  const body = await c.req.json<{
    sessionId?: string;
    message?: string;
    focusDocumentId?: number;
  }>();
  const sessionId = body.sessionId?.trim();
  const query = body.message?.trim();
  const focusDocumentId =
    typeof body.focusDocumentId === "number" ? body.focusDocumentId : undefined;

  if (!sessionId) {
    return c.json({ error: "sessionId is required" }, 400);
  }

  if (!query) {
    return c.json({ error: "message is required" }, 400);
  }

  const session = await getSession(sessionId);
  if (!session) {
    return c.json({ error: "session not found" }, 404);
  }

  const userMessage = await appendMessage(sessionId, "user", query);

  return streamSSE(c, async (stream) => {
    let assistantText = "";
    try {
      for await (const event of ragStream(
        query,
        sessionId,
        session.model,
        userMessage.sequence,
        session.provider,
        focusDocumentId,
      )) {
        if (event.type === "token") {
          assistantText += event.data;
          await stream.writeSSE({ data: JSON.stringify(event.data) });
        } else if (event.type === "sources") {
          await stream.writeSSE({
            event: "sources",
            data: JSON.stringify(event.data),
          });
        }
      }

      if (assistantText.trim()) {
        await appendMessage(sessionId, "assistant", assistantText);
      }

      await stream.writeSSE({ data: "[DONE]" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await stream.writeSSE({ data: `[ERROR] ${msg}` });
    }
  });
});

app.get("/api/chat/sessions", async (c) => {
  const sessions = await listSessions();
  return c.json(sessions);
});

app.get("/api/chat/sessions/latest", async (c) => {
  const session = await getLatestSession();
  return c.json(session);
});

app.post("/api/chat/sessions", async (c) => {
  const body = await c.req
    .json<{ model?: string; provider?: string }>()
    .catch(() => ({}) as { model?: string; provider?: string });
  const model = body.model?.trim();
  const provider = body.provider?.trim() || DEFAULT_CHAT_PROVIDER;
  const session = await createSession(model, provider);
  return c.json(session, 201);
});

app.get("/api/chat/sessions/:id", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) {
    return c.json({ error: "session not found" }, 404);
  }

  return c.json(session);
});

app.delete("/api/chat/sessions/:id", async (c) => {
  const deleted = await deleteSession(c.req.param("id"));
  if (!deleted) {
    return c.json({ error: "session not found" }, 404);
  }
  return c.json({ ok: true });
});

app.patch("/api/chat/sessions/:id", async (c) => {
  const body = await c.req.json<{ model?: string; provider?: string }>();
  const model = body.model?.trim();
  if (!model) {
    return c.json({ error: "model is required" }, 400);
  }

  const provider = body.provider?.trim();
  const session = await updateSessionModel(c.req.param("id"), model, provider);
  if (!session) {
    return c.json({ error: "session not found" }, 404);
  }

  return c.json(session);
});

app.get("/api/models", async (c) => {
  type ModelWithProvider = {
    id: string;
    object: string;
    ownedBy: string;
    provider: string;
  };
  const allModels: ModelWithProvider[] = [];

  // Fetch LM Studio models
  try {
    const lmModels = await listChatModels(lmClient);
    for (const m of lmModels) {
      allModels.push({ ...m, provider: "lmstudio" });
    }
  } catch {
    // LM Studio unavailable — add default model as fallback
  }

  // Ensure default model is present
  if (
    !allModels.some(
      (m) => m.id === DEFAULT_CHAT_MODEL && m.provider === DEFAULT_CHAT_PROVIDER,
    )
  ) {
    allModels.push({
      id: DEFAULT_CHAT_MODEL,
      object: "model",
      ownedBy: "default",
      provider: DEFAULT_CHAT_PROVIDER,
    });
  }

  // Fetch OpenRouter models if configured
  if (orClient) {
    try {
      const orModels = await listChatModels(orClient);
      for (const m of orModels) {
        allModels.push({ ...m, provider: "openrouter" });
      }
    } catch {
      // OpenRouter unavailable
    }
  }

  // Dedupe per provider
  const seen = new Set<string>();
  const deduped = allModels.filter((m) => {
    const key = `${m.provider}:${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return c.json({
    defaultModel: DEFAULT_CHAT_MODEL,
    defaultProvider: DEFAULT_CHAT_PROVIDER,
    providers,
    models: deduped.sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id),
    ),
  });
});

// Status endpoint
app.get("/api/status", async (c) => {
  const docs = await pool.query("SELECT COUNT(*) AS count FROM documents");
  const chunks = await pool.query("SELECT COUNT(*) AS count FROM chunks");

  return c.json({
    documents: parseInt(docs.rows[0].count as string, 10),
    chunks: parseInt(chunks.rows[0].count as string, 10),
  });
});

app.get("/api/documents", async (c) => {
  const documents = await listDocuments();
  return c.json(documents);
});

app.get("/api/documents/:id", async (c) => {
  const documentId = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(documentId)) {
    return c.json({ error: "invalid document id" }, 400);
  }

  try {
    const document = await getDocumentPreview(documentId);
    if (!document) {
      return c.json({ error: "document not found" }, 404);
    }

    return c.json(document);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ error: "document file not found" }, 404);
    }
    throw error;
  }
});

app.delete("/api/documents/:id", async (c) => {
  const documentId = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(documentId)) {
    return c.json({ error: "invalid document id" }, 400);
  }

  const deleted = await deleteDocument(documentId);
  if (!deleted) {
    return c.json({ error: "document not found" }, 404);
  }

  return c.json({ ok: true });
});

// ── Quiz endpoints ──

app.post("/api/quizzes", async (c) => {
  const body = await c.req.json<{
    documentId?: number;
    numQuestions?: number;
    difficulty?: string;
  }>();

  const documentId = body.documentId;
  if (typeof documentId !== "number") {
    return c.json({ error: "documentId is required" }, 400);
  }

  const numQuestions = body.numQuestions ?? 10;
  if (![5, 10, 20].includes(numQuestions)) {
    return c.json({ error: "numQuestions must be 5, 10, or 20" }, 400);
  }

  const difficulty = body.difficulty ?? "medium";
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return c.json({ error: "difficulty must be easy, medium, or hard" }, 400);
  }

  try {
    const generated = await generateQuiz(
      documentId,
      numQuestions,
      difficulty as "easy" | "medium" | "hard",
    );
    const quiz = await createQuizInDb(
      documentId,
      difficulty as "easy" | "medium" | "hard",
      generated.model,
      generated.provider,
      generated.questions,
    );
    return c.json(quiz, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quiz generation failed";
    return c.json({ error: msg }, 500);
  }
});

app.get("/api/quizzes", async (c) => {
  const quizzes = await listQuizzes();
  return c.json(quizzes);
});

app.get("/api/quizzes/:id", async (c) => {
  const quiz = await getQuiz(c.req.param("id"));
  if (!quiz) return c.json({ error: "quiz not found" }, 404);
  return c.json(quiz);
});

app.delete("/api/quizzes/:id", async (c) => {
  const deleted = await deleteQuiz(c.req.param("id"));
  if (!deleted) return c.json({ error: "quiz not found" }, 404);
  return c.json({ ok: true });
});

app.patch("/api/quizzes/:id/questions/:index", async (c) => {
  const quizId = c.req.param("id");
  const questionIndex = Number.parseInt(c.req.param("index"), 10);
  if (!Number.isInteger(questionIndex)) {
    return c.json({ error: "invalid question index" }, 400);
  }

  const body = await c.req.json<{ selectedAnswer?: string | null }>();
  const selectedAnswer = body.selectedAnswer ?? null;
  if (
    selectedAnswer !== null &&
    !["A", "B", "C", "D"].includes(selectedAnswer)
  ) {
    return c.json({ error: "selectedAnswer must be A, B, C, D, or null" }, 400);
  }

  const updated = await answerQuestion(
    quizId,
    questionIndex,
    selectedAnswer as "A" | "B" | "C" | "D" | null,
  );
  if (!updated) return c.json({ error: "question not found" }, 404);
  return c.json({ ok: true });
});

app.post("/api/quizzes/:id/restart", async (c) => {
  await restartQuiz(c.req.param("id"));
  const quiz = await getQuiz(c.req.param("id"));
  if (!quiz) return c.json({ error: "quiz not found" }, 404);
  return c.json(quiz);
});

app.post("/api/quizzes/:id/complete", async (c) => {
  const quiz = await completeQuiz(c.req.param("id"));
  if (!quiz) return c.json({ error: "quiz not found" }, 404);
  return c.json(quiz);
});

// Manual re-index endpoint
app.post("/api/reindex", async (c) => {
  const result = await indexAll();
  return c.json(result);
});

// Serve built Svelte SPA from ui/dist/
const uiDist = resolve(__dirname, "ui/dist");

app.get("/*", async (c, next) => {
  const filePath = resolve(
    uiDist,
    c.req.path.replace(/^\//, "") || "index.html",
  );
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file);
  }
  // SPA fallback: serve index.html for non-API routes
  return new Response(Bun.file(resolve(uiDist, "index.html")));
});
