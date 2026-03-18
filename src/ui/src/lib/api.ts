import type {
  Session,
  SessionSummary,
  DocumentPreview,
  Document,
  ModelsPayload,
  StatusPayload,
  SSEEvent,
  Quiz,
  QuizSummary,
} from "./types";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchStatus(): Promise<StatusPayload> {
  return json("/api/status");
}

export function fetchModels(): Promise<ModelsPayload> {
  return json("/api/models");
}

export function fetchSessions(): Promise<SessionSummary[]> {
  return json("/api/chat/sessions");
}

export function fetchLatestSession(): Promise<Session> {
  return json("/api/chat/sessions/latest");
}

export function fetchSession(id: string): Promise<Session> {
  return json(`/api/chat/sessions/${id}`);
}

export function createSession(model: string, provider: string): Promise<Session> {
  return json("/api/chat/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, provider }),
  });
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return json(`/api/chat/sessions/${id}`, { method: "DELETE" });
}

export function patchSessionModel(
  id: string,
  model: string,
  provider: string,
): Promise<Session> {
  return json(`/api/chat/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, provider }),
  });
}

export function fetchDocuments(): Promise<Document[]> {
  return json("/api/documents");
}

export function fetchDocument(id: number): Promise<DocumentPreview> {
  return json(`/api/documents/${id}`);
}

export function deleteDocument(id: number): Promise<{ ok: boolean }> {
  return json(`/api/documents/${id}`, { method: "DELETE" });
}

// ── Quiz API ──

export function fetchQuizzes(): Promise<QuizSummary[]> {
  return json("/api/quizzes");
}

export function fetchQuiz(id: string): Promise<Quiz> {
  return json(`/api/quizzes/${id}`);
}

export function createQuiz(opts: {
  documentId: number;
  numQuestions: number;
  difficulty: string;
}): Promise<Quiz> {
  return json("/api/quizzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
}

export function deleteQuizApi(id: string): Promise<{ ok: boolean }> {
  return json(`/api/quizzes/${id}`, { method: "DELETE" });
}

export function answerQuizQuestion(
  quizId: string,
  questionIndex: number,
  selectedAnswer: string | null,
): Promise<{ ok: boolean }> {
  return json(`/api/quizzes/${quizId}/questions/${questionIndex}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedAnswer }),
  });
}

export function restartQuizApi(id: string): Promise<Quiz> {
  return json(`/api/quizzes/${id}/restart`, { method: "POST" });
}

export function completeQuizApi(id: string): Promise<Quiz> {
  return json(`/api/quizzes/${id}/complete`, { method: "POST" });
}

export async function* streamChat(
  sessionId: string,
  message: string,
  focusDocumentId?: number,
): AsyncGenerator<SSEEvent> {
  const body: Record<string, unknown> = { sessionId, message };
  if (focusDocumentId != null) body.focusDocumentId = focusDocumentId;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("event: ")) {
        currentEvent = trimmed.slice(7);
        continue;
      }

      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);

      if (currentEvent === "sources") {
        currentEvent = "";
        try {
          yield { type: "sources", data: JSON.parse(data) };
        } catch {
          /* skip malformed */
        }
        continue;
      }
      currentEvent = "";

      if (data === "[DONE]") {
        yield { type: "done" };
        continue;
      }

      if (data.startsWith("[ERROR]")) {
        yield { type: "error", data: data };
        continue;
      }

      try {
        yield { type: "token", data: JSON.parse(data) };
      } catch {
        yield { type: "token", data };
      }
    }
  }
}
