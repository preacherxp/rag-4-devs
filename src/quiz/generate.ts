import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  stripJsonMarkdownFences,
  structuredChat,
  structuredStreamChat,
} from "../lmstudio/index.js";
import { getClientForProvider } from "../llm.js";
import { pool } from "../db/pool.js";
import { DEFAULT_CHAT_MODEL, DEFAULT_CHAT_PROVIDER } from "../config.js";
import { StructuredChatError } from "../lmstudio/structured.js";
import { createLogger } from "../logger.js";
import type { QuizDifficulty, AnswerLetter } from "./store.js";

const LETTERS: AnswerLetter[] = ["A", "B", "C", "D"];
const MAX_QUIZ_GENERATION_ATTEMPTS = 3;
const MAX_CORRECT_OPTION_LENGTH_RATIO = 1.8;
const MIN_CORRECT_OPTION_LENGTH_DELTA = 24;
const MIN_SENTENCE_STYLE_WORDS = 8;
const MAX_RETRY_FEEDBACK_ITEMS = 8;
const MAX_LOG_PREVIEW_CHARS = 1200;

const GENERIC_DISTRACTOR_PATTERNS = [
  /^(all|none) of the above$/i,
  /^not (mentioned|specified|stated)( in the text)?$/i,
  /^cannot be determined$/i,
  /^it depends$/i,
  /^something else$/i,
  /^other factors$/i,
] as const;

type GeneratedQuestion = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: AnswerLetter;
};

const FlexibleCorrectAnswerSchema = z.union([z.string(), z.number().int()]);

const RawQuizQuestionSchema = z
  .object({
    question: z.string(),
    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
    options: z.array(z.string()).length(4).optional(),
    correctAnswer: FlexibleCorrectAnswerSchema.optional(),
    correct_answer: FlexibleCorrectAnswerSchema.optional(),
    correctOption: FlexibleCorrectAnswerSchema.optional(),
    correct_option: FlexibleCorrectAnswerSchema.optional(),
    answer: FlexibleCorrectAnswerSchema.optional(),
  })
  .passthrough();

const RawQuizResponseSchema = z.object({
  questions: z.array(RawQuizQuestionSchema),
});

type RawGeneratedQuestion = z.infer<typeof RawQuizQuestionSchema>;
type RawQuizResponse = z.infer<typeof RawQuizResponseSchema>;

/** Randomize option order so the correct answer is not LLM-position-biased. */
export function shuffleQuestionOptions(q: GeneratedQuestion): GeneratedQuestion {
  const texts = [q.optionA, q.optionB, q.optionC, q.optionD];
  const perm = [0, 1, 2, 3];
  for (let i = perm.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }
  const oldCorrect = LETTERS.indexOf(q.correctAnswer);
  const newCorrectSlot = perm.indexOf(oldCorrect);
  return {
    question: q.question,
    optionA: texts[perm[0]!]!,
    optionB: texts[perm[1]!]!,
    optionC: texts[perm[2]!]!,
    optionD: texts[perm[3]!]!,
    correctAnswer: LETTERS[newCorrectSlot]!,
  };
}

const DIFFICULTY_DESCRIPTIONS: Record<QuizDifficulty, string> = {
  easy: "Factual recall — the correct answer is explicitly stated or unambiguously implied in one place. Stems name specific terms, definitions, or facts from the text.",
  medium:
    "Understanding — stems ask which option best explains a relationship, cause/effect, contrast, or consequence grounded in the text. Requires connecting two ideas the document links or compares.",
  hard: "Inference and synthesis — stems require combining details from different parts of the text, or choosing the option that best follows from the document's claims (no invented scenarios). Prefer 'which best explains', 'what follows', or resolving a subtle tension the text addresses.",
};

function buildSystemPrompt(
  numQuestions: number,
  difficulty: QuizDifficulty,
  language?: string,
): string {
  const languageRule = language
    ? `- Write all questions and options in ${language}`
    : "- Match the language of the document content";

  return `You are a quiz generator. Based on the document content provided, generate exactly ${numQuestions} multiple-choice questions.

Difficulty: ${difficulty}
${DIFFICULTY_DESCRIPTIONS[difficulty]}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Exactly one option must be correct
- Use this exact JSON shape for each question: {"question":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"A"}
- Do not use an "options" array and do not return the correct answer as free text
- Every question must be fully answerable from the supplied text only. If a fact is not clearly supported, skip that topic and choose another
- Wrong options must be plausible in the same domain but contradicted or ruled out by the document — use near-misses, reversed causality, overgeneralizations, or subtle misreadings; avoid unrelated trivia
- Make all four options look equally viable at first glance: keep option length, specificity, and tone roughly balanced so the correct answer does not stand out
- Keep options in the same semantic category and grammatical form; if one option is a full explanatory sentence, the others should be too
- Avoid giveaway distractors such as generic placeholders, throwaway fragments, "all/none of the above", or options that are much shorter and vaguer than the correct answer
- Spread questions across different sections and themes so coverage is broad, not repetitive
- Option order will be randomized server-side; do not try to balance which letter is correct — focus on stem and distractor quality
- Use precise wording tied to concepts in the document; avoid vague framing like "according to the document" unless the stem truly needs it
${languageRule}
- No questions about filenames, chunk boundaries, formatting, indexes, or other metadata
- Respond with valid JSON matching the required schema`;
}

function maxChunksForQuiz(numQuestions: number): number {
  return Math.min(36, Math.max(20, numQuestions * 2));
}

async function getDocumentContent(
  documentId: number,
  maxChunks: number,
): Promise<{ text: string; chunkCount: number }> {
  const result = await pool.query(
    `SELECT heading, content FROM chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [documentId],
  );

  let chunks = result.rows as Array<{ heading: string; content: string }>;

  // Evenly sample along chunk_index so long docs stay represented
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

export type GenerateQuizOptions = {
  onProgress?: (p: QuizGenProgress) => void | Promise<void>;
  signal?: AbortSignal;
  requestId?: string;
  language?: string;
};

async function emitProgress(
  onProgress: ((p: QuizGenProgress) => void | Promise<void>) | undefined,
  p: QuizGenProgress,
) {
  if (!onProgress) return;
  await Promise.resolve(onProgress(p));
}

function truncateForLog(text: string, maxChars = MAX_LOG_PREVIEW_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function optionTexts(q: GeneratedQuestion): string[] {
  return [q.optionA, q.optionB, q.optionC, q.optionD];
}

function extractTopLevelJsonValues(text: string): string[] {
  const stripped = stripJsonMarkdownFences(text);
  const values: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i]!;

    if (start === -1) {
      if (char === "{" || char === "[") {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth++;
      continue;
    }

    if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        values.push(stripped.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return values;
}

function coerceParsedQuizResponse(parsed: unknown): RawQuizResponse {
  const wrapped = RawQuizResponseSchema.safeParse(parsed);
  if (wrapped.success) {
    return wrapped.data;
  }

  const singleQuestion = RawQuizQuestionSchema.safeParse(parsed);
  if (singleQuestion.success) {
    return { questions: [singleQuestion.data] };
  }

  const questionArray = z.array(RawQuizQuestionSchema).safeParse(parsed);
  if (questionArray.success) {
    return { questions: questionArray.data };
  }

  throw new Error("Parsed JSON did not match any supported quiz response shape");
}

export function recoverQuizResponse(rawText: string): RawQuizResponse {
  const values = extractTopLevelJsonValues(rawText);

  if (values.length === 0) {
    throw new Error("No recoverable JSON values found in quiz response");
  }

  if (values.length === 1) {
    return coerceParsedQuizResponse(JSON.parse(values[0]!));
  }

  return {
    questions: values.map((value) => RawQuizQuestionSchema.parse(JSON.parse(value))),
  };
}

function getQuestionOptions(question: RawGeneratedQuestion): string[] {
  if (question.optionA && question.optionB && question.optionC && question.optionD) {
    return [question.optionA, question.optionB, question.optionC, question.optionD].map(
      normalizeWhitespace,
    );
  }

  if (question.options) {
    return question.options.map(normalizeWhitespace);
  }

  throw new Error("Question is missing the required answer options");
}

function resolveCorrectAnswer(
  rawCorrectAnswer: string | number | undefined,
  options: string[],
): AnswerLetter {
  if (typeof rawCorrectAnswer === "number") {
    if (rawCorrectAnswer >= 0 && rawCorrectAnswer < LETTERS.length) {
      return LETTERS[rawCorrectAnswer]!;
    }
    if (rawCorrectAnswer >= 1 && rawCorrectAnswer <= LETTERS.length) {
      return LETTERS[rawCorrectAnswer - 1]!;
    }
  }

  if (typeof rawCorrectAnswer === "string") {
    const normalized = normalizeWhitespace(rawCorrectAnswer);
    const directMatch = options.findIndex(
      (option) => normalizeFingerprint(option) === normalizeFingerprint(normalized),
    );
    if (directMatch >= 0) {
      return LETTERS[directMatch]!;
    }

    const upper = normalized.toUpperCase();
    if (LETTERS.includes(upper as AnswerLetter)) {
      return upper as AnswerLetter;
    }

    const letterMatch = upper.match(/^(?:OPTION\s*)?([ABCD])(?:[\s).:-]*)$/);
    if (letterMatch) {
      return letterMatch[1] as AnswerLetter;
    }
  }

  throw new Error(`Could not resolve correct answer from value: ${String(rawCorrectAnswer)}`);
}

export function normalizeGeneratedQuestions(
  rawQuestions: RawGeneratedQuestion[],
): GeneratedQuestion[] {
  return rawQuestions.map((question) => {
    const options = getQuestionOptions(question);
    const rawCorrectAnswer =
      question.correctAnswer ??
      question.correct_answer ??
      question.correctOption ??
      question.correct_option ??
      question.answer;

    return {
      question: normalizeWhitespace(question.question),
      optionA: options[0]!,
      optionB: options[1]!,
      optionC: options[2]!,
      optionD: options[3]!,
      correctAnswer: resolveCorrectAnswer(rawCorrectAnswer, options),
    };
  });
}

function correctOptionIndex(q: GeneratedQuestion): number {
  return LETTERS.indexOf(q.correctAnswer);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeFingerprint(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function tokens(text: string): string[] {
  const normalized = normalizeFingerprint(text);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function tokenSet(text: string): Set<string> {
  return new Set(tokens(text));
}

function wordCount(text: string): number {
  return tokens(text).length;
}

function charCount(text: string): number {
  return normalizeWhitespace(text).length;
}

function isSentenceLike(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  return (
    /[.!?]$/.test(normalized) ||
    /[,;:]/.test(normalized) ||
    wordCount(text) >= MIN_SENTENCE_STYLE_WORDS
  );
}

function isGenericDistractor(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  return GENERIC_DISTRACTOR_PATTERNS.some((pattern) => pattern.test(normalized));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function hasNearDuplicateOptions(options: string[]): boolean {
  const fingerprints = options.map(normalizeFingerprint);
  const tokenSets = options.map(tokenSet);
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (fingerprints[i] === fingerprints[j]) return true;
      const similarity = jaccardSimilarity(tokenSets[i]!, tokenSets[j]!);
      const smaller = Math.min(tokenSets[i]!.size, tokenSets[j]!.size);
      if (smaller >= 3 && similarity >= 0.82) return true;
    }
  }
  return false;
}

export function inspectQuestionQuality(q: GeneratedQuestion): string[] {
  const options = optionTexts(q).map((text) => ({
    text,
    chars: charCount(text),
    words: wordCount(text),
    sentenceLike: isSentenceLike(text),
    generic: isGenericDistractor(text),
  }));

  const issues: string[] = [];
  const correctIndex = correctOptionIndex(q);
  const correct = options[correctIndex]!;
  const distractors = options.filter((_option, index) => index !== correctIndex);
  const sortedDistractorChars = distractors.map((option) => option.chars).sort((a, b) => a - b);
  const medianDistractorChars =
    sortedDistractorChars[Math.floor(sortedDistractorChars.length / 2)] ?? 0;

  if (
    correct.chars >= medianDistractorChars * MAX_CORRECT_OPTION_LENGTH_RATIO &&
    correct.chars - medianDistractorChars >= MIN_CORRECT_OPTION_LENGTH_DELTA
  ) {
    issues.push("correct option is much longer than distractors");
  }

  const shortDistractorCount = distractors.filter(
    (option) => correct.words >= 6 && option.words <= Math.max(2, Math.floor(correct.words * 0.4)),
  ).length;
  if (shortDistractorCount >= 2) {
    issues.push("distractors are much shorter or less specific than the correct option");
  }

  if (distractors.some((option) => option.generic)) {
    issues.push("one or more distractors are generic giveaway answers");
  }

  const matchingStyleCount = options.filter(
    (option) => option.sentenceLike === correct.sentenceLike,
  ).length;
  if (matchingStyleCount === 1) {
    issues.push("correct option uses a different style than the other options");
  }

  if (hasNearDuplicateOptions(options.map((option) => option.text))) {
    issues.push("options contain duplicates or near-duplicates");
  }

  return issues;
}

export function validateGeneratedQuestions(
  questions: GeneratedQuestion[],
  expectedCount: number,
): string[] {
  const issues: string[] = [];
  if (questions.length !== expectedCount) {
    issues.push(`expected ${expectedCount} questions but received ${questions.length}`);
  }
  questions.forEach((question, index) => {
    const questionIssues = inspectQuestionQuality(question);
    for (const issue of questionIssues) {
      issues.push(`Question ${index + 1}: ${issue}`);
    }
  });
  return issues;
}

function buildRetryPrompt(issues: string[]): string {
  const items = issues
    .slice(0, MAX_RETRY_FEEDBACK_ITEMS)
    .map((issue) => `- ${issue}`)
    .join("\n");
  return `Regenerate the entire quiz from scratch and fix these quality problems:
${items}
- Keep every answer option plausible at first glance and balanced in length, specificity, and style.`;
}

async function requestQuizResponse(
  chatOpts: {
    model: string;
    messages: { role: "system" | "user"; content: string }[];
    schema: typeof RawQuizResponseSchema;
    temperature: number;
    maxTokens: number;
  },
  client: ReturnType<typeof getClientForProvider>,
  opts?: GenerateQuizOptions & {
    logger?: ReturnType<typeof createLogger>;
  },
): Promise<z.infer<typeof RawQuizResponseSchema>> {
  const rescueStructuredError = (error: unknown): z.infer<typeof RawQuizResponseSchema> => {
    if (!(error instanceof StructuredChatError)) throw error;
    return recoverQuizResponse(error.rawText);
  };

  if (opts?.onProgress || opts?.signal) {
    let charsReceived = 0;
    let lastReported = 0;
    let lastReportTime = 0;
    const minChars = 384;
    const minMs = 320;

    try {
      return await structuredStreamChat(client, {
        ...chatOpts,
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
        onToken: (token) => {
          charsReceived += token.length;
          const now = Date.now();
          if (charsReceived - lastReported >= minChars || now - lastReportTime >= minMs) {
            lastReported = charsReceived;
            lastReportTime = now;
            opts.logger?.debug("quiz_generation_stream_progress", {
              charsReceived,
            });
            void emitProgress(opts?.onProgress, {
              phase: "generating",
              charsReceived,
            });
          }
        },
        onStreamComplete: async () => {
          opts.logger?.debug("quiz_generation_stream_complete", {
            charsReceived,
          });
          await emitProgress(opts?.onProgress, {
            phase: "generating",
            charsReceived,
          });
          await emitProgress(opts?.onProgress, { phase: "parsing" });
        },
      });
    } catch (error) {
      const recovered = rescueStructuredError(error);
      opts.logger?.warn("quiz_generation_response_recovered", {
        recoveryMethod: "structured_stream_fallback",
        recoveredQuestionCount: recovered.questions.length,
      });
      return recovered;
    }
  }

  try {
    return await structuredChat(client, chatOpts);
  } catch (error) {
    const recovered = rescueStructuredError(error);
    // @ts-expect-error: opts is possibly undefined
    opts.logger?.warn("quiz_generation_response_recovered", {
      recoveryMethod: "structured_fallback",
      recoveredQuestionCount: recovered.questions.length,
    });
    return recovered;
  }
}

export async function generateQuiz(
  documentId: number,
  numQuestions: number,
  difficulty: QuizDifficulty,
  model = DEFAULT_CHAT_MODEL,
  provider = DEFAULT_CHAT_PROVIDER,
  opts?: GenerateQuizOptions,
): Promise<{
  model: string;
  provider: string;
  questions: GeneratedQuestion[];
}> {
  const requestId = opts?.requestId ?? randomUUID();
  const logger = createLogger("quiz", {
    requestId,
    documentId,
    numQuestions,
    difficulty,
    model,
    provider,
  });
  const generationStartedAt = Date.now();
  logger.info("quiz_generation_started");

  const { text: content, chunkCount } = await getDocumentContent(
    documentId,
    maxChunksForQuiz(numQuestions),
  );
  await emitProgress(opts?.onProgress, {
    phase: "document",
    chunkCount,
    charCount: content.length,
  });
  logger.info("quiz_generation_document_loaded", {
    chunkCount,
    charCount: content.length,
  });

  if (!content.trim()) {
    logger.error("quiz_generation_missing_document_content");
    throw new Error("Document has no indexed content");
  }

  const client = getClientForProvider(provider);
  let retryIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_QUIZ_GENERATION_ATTEMPTS; attempt++) {
    const attemptNumber = attempt + 1;
    const messages: { role: "system" | "user"; content: string }[] = [
      {
        role: "system",
        content: buildSystemPrompt(numQuestions, difficulty, opts?.language),
      },
      ...(retryIssues.length > 0
        ? [{ role: "system" as const, content: buildRetryPrompt(retryIssues) }]
        : []),
      { role: "user", content },
    ];

    const attemptStartedAt = Date.now();
    logger.info("quiz_generation_attempt_started", {
      attempt: attemptNumber,
      maxAttempts: MAX_QUIZ_GENERATION_ATTEMPTS,
      retryIssueCount: retryIssues.length,
      retryIssues: retryIssues.length > 0 ? retryIssues : undefined,
      messageCount: messages.length,
      promptCharCount: messages.reduce((sum, message) => sum + message.content.length, 0),
    });

    let response: z.infer<typeof RawQuizResponseSchema>;
    try {
      response = await requestQuizResponse(
        {
          model,
          messages,
          schema: RawQuizResponseSchema,
          temperature: 0.6,
          maxTokens: 8192,
        },
        client,
        { ...opts, logger },
      );
    } catch (error) {
      const fields: Record<string, unknown> = {
        attempt: attemptNumber,
        elapsedMs: Date.now() - attemptStartedAt,
        error,
      };
      if (error instanceof StructuredChatError) {
        fields.failureStage = error.stage;
        fields.rawResponseChars = error.rawText.length;
        fields.rawResponsePreview = truncateForLog(error.rawText);
      }
      logger.error("quiz_generation_attempt_failed", fields);
      throw error;
    }

    logger.info("quiz_generation_attempt_received_response", {
      attempt: attemptNumber,
      elapsedMs: Date.now() - attemptStartedAt,
      returnedQuestionCount: response.questions.length,
    });

    let trimmed: GeneratedQuestion[];
    try {
      trimmed = normalizeGeneratedQuestions(response.questions.slice(0, numQuestions));
    } catch (error) {
      logger.error("quiz_generation_response_normalization_failed", {
        attempt: attemptNumber,
        elapsedMs: Date.now() - attemptStartedAt,
        error,
      });
      throw error;
    }
    const qualityIssues = validateGeneratedQuestions(trimmed, numQuestions);
    if (qualityIssues.length === 0) {
      logger.info("quiz_generation_succeeded", {
        attempt: attemptNumber,
        elapsedMs: Date.now() - generationStartedAt,
        questionCount: trimmed.length,
      });
      return {
        model,
        provider,
        questions: trimmed.map(shuffleQuestionOptions),
      };
    }

    logger.warn("quiz_generation_quality_check_failed", {
      attempt: attemptNumber,
      elapsedMs: Date.now() - attemptStartedAt,
      issueCount: qualityIssues.length,
      issues: qualityIssues,
      returnedQuestionCount: response.questions.length,
    });
    retryIssues = qualityIssues;
  }

  logger.error("quiz_generation_failed_after_retries", {
    attempts: MAX_QUIZ_GENERATION_ATTEMPTS,
    issueCount: retryIssues.length,
    issues: retryIssues,
    elapsedMs: Date.now() - generationStartedAt,
  });
  throw new Error(
    `Quiz generation failed quality checks after ${MAX_QUIZ_GENERATION_ATTEMPTS} attempts: ${retryIssues.join("; ")}`,
  );
}
