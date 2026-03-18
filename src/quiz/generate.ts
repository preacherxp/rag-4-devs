import { z } from "zod";
import { structuredChat } from "../lmstudio/index.js";
import { orClient } from "../llm.js";
import { pool } from "../db/pool.js";
import type { QuizDifficulty, AnswerLetter } from "./store.js";

const QUIZ_MODEL = "openai/gpt-5.4-nano";

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
): Promise<string> {
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

  return chunks
    .map((c) => (c.heading ? `## ${c.heading}\n\n${c.content}` : c.content))
    .join("\n\n---\n\n");
}

export async function generateQuiz(
  documentId: number,
  numQuestions: number,
  difficulty: QuizDifficulty,
): Promise<{
  model: string;
  provider: string;
  questions: GeneratedQuestion[];
}> {
  if (!orClient) {
    throw new Error(
      "OpenRouter is not configured — required for quiz generation",
    );
  }

  const content = await getDocumentContent(documentId);
  if (!content.trim()) {
    throw new Error("Document has no indexed content");
  }

  const response = await structuredChat(orClient, {
    model: QUIZ_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(numQuestions, difficulty) },
      { role: "user", content },
    ],
    schema: QuizResponseSchema,
    temperature: 0.7,
    maxTokens: 8192,
  });

  return {
    model: QUIZ_MODEL,
    provider: "openrouter",
    questions: response.questions.slice(0, numQuestions),
  };
}
