import { z } from "zod";
import { structuredChat, structuredStreamChat } from "../lmstudio/index.js";
import { getClientForProvider } from "../llm.js";
import { pool } from "../db/pool.js";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_PROVIDER,
} from "../config.js";
import type { QuizDifficulty, AnswerLetter } from "./store.js";

const QuizResponseSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      optionA: z.string(),
      optionB: z.string(),
      optionC: z.string(),
      optionD: z.string(),
      correctAnswer: z.enum(["A", "B", "C", "D"]),
    }),
  ),
});

type GeneratedQuestion = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: AnswerLetter;
};

const DIFFICULTY_DESCRIPTIONS: Record<QuizDifficulty, string> = {
  easy: "Factual recall — answers are directly stated in the text. Test basic memory of key facts, definitions, and explicit statements.",
  medium:
    "Understanding — requires grasping relationships between concepts, cause-and-effect, or comparing ideas from the text.",
  hard: "Inference and synthesis — requires reading between the lines, applying concepts to new situations, or combining information from multiple parts of the text.",
};

function buildSystemPrompt(
  numQuestions: number,
  difficulty: QuizDifficulty,
): string {
  return `You are a quiz generator. Based on the document content provided, generate exactly ${numQuestions} multiple-choice questions.

Difficulty: ${difficulty}
${DIFFICULTY_DESCRIPTIONS[difficulty]}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Exactly one option must be correct
- Wrong options should be plausible but clearly incorrect based on the document
- Questions should cover different parts of the document
- Match the language of the document content
- Do not include questions about metadata, formatting, or document structure
- Respond with valid JSON matching the required schema`;
}

async function getDocumentContent(
  documentId: number,
  maxChunks = 20,
): Promise<{ text: string; chunkCount: number }> {
  const result = await pool.query(
    `SELECT heading, content FROM chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [documentId],
  );

  let chunks = result.rows as Array<{ heading: string; content: string }>;

  // Sample evenly if too many chunks
  if (chunks.length > maxChunks) {
    const step = chunks.length / maxChunks;
    const sampled: typeof chunks = [];
    for (let i = 0; i < maxChunks; i++) {
      sampled.push(chunks[Math.floor(i * step)]!);
    }
    chunks = sampled;
  }

  const text = chunks
    .map((c) => (c.heading ? `## ${c.heading}\n\n${c.content}` : c.content))
    .join("\n\n---\n\n");

  return { text, chunkCount: chunks.length };
}

export type QuizGenProgress =
  | { phase: "document"; chunkCount: number; charCount: number }
  | { phase: "generating"; charsReceived: number }
  | { phase: "parsing" }
  | { phase: "saving" };

async function emitProgress(
  onProgress: ((p: QuizGenProgress) => void | Promise<void>) | undefined,
  p: QuizGenProgress,
) {
  if (!onProgress) return;
  await Promise.resolve(onProgress(p));
}

export async function generateQuiz(
  documentId: number,
  numQuestions: number,
  difficulty: QuizDifficulty,
  model = DEFAULT_CHAT_MODEL,
  provider = DEFAULT_CHAT_PROVIDER,
  opts?: {
    onProgress?: (p: QuizGenProgress) => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<{
  model: string;
  provider: string;
  questions: GeneratedQuestion[];
}> {
  const { text: content, chunkCount } = await getDocumentContent(documentId);
  await emitProgress(opts?.onProgress, {
    phase: "document",
    chunkCount,
    charCount: content.length,
  });

  if (!content.trim()) {
    throw new Error("Document has no indexed content");
  }

  const client = getClientForProvider(provider);
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(numQuestions, difficulty) },
    { role: "user", content },
  ];

  const chatOpts = {
    model,
    messages,
    schema: QuizResponseSchema,
    temperature: 0.7,
    maxTokens: 8192,
  };

  let response: z.infer<typeof QuizResponseSchema>;

  if (opts?.onProgress || opts?.signal) {
    let charsReceived = 0;
    let lastReported = 0;
    let lastReportTime = 0;
    const minChars = 384;
    const minMs = 320;

    response = await structuredStreamChat(client, {
      ...chatOpts,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
      onToken: (token) => {
        charsReceived += token.length;
        const now = Date.now();
        if (
          charsReceived - lastReported >= minChars ||
          now - lastReportTime >= minMs
        ) {
          lastReported = charsReceived;
          lastReportTime = now;
          void emitProgress(opts?.onProgress, {
            phase: "generating",
            charsReceived,
          });
        }
      },
      onStreamComplete: async () => {
        await emitProgress(opts?.onProgress, {
          phase: "generating",
          charsReceived,
        });
        await emitProgress(opts?.onProgress, { phase: "parsing" });
      },
    });
  } else {
    response = await structuredChat(client, chatOpts);
  }

  return {
    model,
    provider,
    questions: response.questions.slice(0, numQuestions),
  };
}
