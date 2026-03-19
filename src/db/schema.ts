import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_PROVIDER,
  config,
} from "../config.js";

const embedDim = config.EMBED_DIMENSION;

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  filePath: text("file_path").notNull().unique(),
  checksum: text("checksum").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey(),
  model: text("model").notNull(),
  provider: text("provider")
    .notNull()
    .default(DEFAULT_CHAT_PROVIDER),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sequence: integer("sequence").notNull(),
  },
  (t) => [
    check(
      "chat_messages_role_check",
      sql`${t.role} IN ('user', 'assistant')`,
    ),
    unique("chat_messages_session_id_sequence_key").on(t.sessionId, t.sequence),
  ],
);

export const chunks = pgTable(
  "chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: embedDim }),
  },
  (t) => [
    unique("chunks_document_id_chunk_index_key").on(t.documentId, t.chunkIndex),
    index("chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    model: text("model").notNull().default(DEFAULT_CHAT_MODEL),
    provider: text("provider").notNull().default(DEFAULT_CHAT_PROVIDER),
    difficulty: text("difficulty").notNull(),
    numQuestions: integer("num_questions").notNull(),
    score: integer("score"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "quizzes_difficulty_check",
      sql`${t.difficulty} IN ('easy', 'medium', 'hard')`,
    ),
  ],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: serial("id").primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    questionIndex: integer("question_index").notNull(),
    question: text("question").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    optionC: text("option_c").notNull(),
    optionD: text("option_d").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    selectedAnswer: text("selected_answer"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "quiz_questions_correct_answer_check",
      sql`${t.correctAnswer} IN ('A', 'B', 'C', 'D')`,
    ),
    check(
      "quiz_questions_selected_answer_check",
      sql`${t.selectedAnswer} IS NULL OR ${t.selectedAnswer} IN ('A', 'B', 'C', 'D')`,
    ),
    unique("quiz_questions_quiz_id_question_index_key").on(
      t.quizId,
      t.questionIndex,
    ),
  ],
);
