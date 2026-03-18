export interface SessionSummary {
  id: string;
  model: string;
  provider: string;
  preview: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sequence: number;
  createdAt: string;
}

export interface Session extends SessionSummary {
  messages: Message[];
}

export interface Document {
  id: number;
  label: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPreview extends Document {
  content: string;
}

export interface Model {
  id: string;
  object: string;
  ownedBy: string;
  provider: string;
}

export interface ModelsPayload {
  defaultModel: string;
  providers: string[];
  models: Model[];
}

export interface Source {
  label: string;
  heading?: string;
  similarity: number;
}

export interface StatusPayload {
  documents: number;
  chunks: number;
}

export type SSEEvent =
  | { type: "token"; data: string }
  | { type: "sources"; data: Source[] }
  | { type: "error"; data: string }
  | { type: "done" };

export interface QuizQuestion {
  questionIndex: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  selectedAnswer: "A" | "B" | "C" | "D" | null;
  answeredAt: string | null;
}

export interface Quiz {
  id: string;
  documentId: number;
  documentLabel: string;
  model: string;
  provider: string;
  difficulty: "easy" | "medium" | "hard";
  numQuestions: number;
  score: number | null;
  completedAt: string | null;
  createdAt: string;
  questions: QuizQuestion[];
}

export interface QuizSummary {
  id: string;
  documentId: number;
  documentLabel: string;
  difficulty: string;
  numQuestions: number;
  score: number | null;
  completedAt: string | null;
  createdAt: string;
  answeredCount: number;
}
