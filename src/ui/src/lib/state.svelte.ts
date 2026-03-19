import type { SessionSummary, Message, Document, Model, QuizSummary, Quiz } from "./types";

export const chat = $state({
  sessionId: "",
  model: "",
  provider: "openrouter",
  defaultModel: "",
  defaultProvider: "openrouter",
  providers: ["openrouter"] as string[],
  sessions: [] as SessionSummary[],
  messages: [] as Message[],
  models: [] as Model[],
  isStreaming: false,
});

export const docs = $state({
  list: [] as Document[],
  selectedId: null as number | null,
  focusedId: null as number | null,
});

export const ui = $state({
  sidebarOpen: true,
  previewOpen: false,
  previewFullscreen: false,
  lightboxSrc: null as string | null,
  status: { documents: 0, chunks: 0 },
  statusError: false,
  activeTab: "sessions" as "sessions" | "documents" | "quizzes",
});

export const quiz = $state({
  list: [] as QuizSummary[],
  activeId: null as string | null,
  activeQuiz: null as Quiz | null,
  currentQuestionIndex: 0,
  isGenerating: false,
  model: "",
  provider: "openrouter",
  defaultModel: "",
  defaultProvider: "openrouter",
});
