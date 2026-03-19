import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { sourceLabel } from "../documents/paths.js";

export type QuizDifficulty = "easy" | "medium" | "hard";
export type AnswerLetter = "A" | "B" | "C" | "D";

export type QuizQuestion = {
  questionIndex: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: AnswerLetter;
  selectedAnswer: AnswerLetter | null;
  answeredAt: string | null;
};

export type Quiz = {
  id: string;
  documentId: number;
  documentLabel: string;
  model: string;
  provider: string;
  difficulty: QuizDifficulty;
  numQuestions: number;
  score: number | null;
  completedAt: string | null;
  createdAt: string;
  questions: QuizQuestion[];
};

export type QuizSummary = {
  id: string;
  documentId: number;
  documentLabel: string;
  model: string;
  difficulty: string;
  numQuestions: number;
  score: number | null;
  completedAt: string | null;
  createdAt: string;
  answeredCount: number;
};

type GeneratedQuestion = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: AnswerLetter;
};

export async function createQuiz(
  documentId: number,
  difficulty: QuizDifficulty,
  model: string,
  provider: string,
  questions: GeneratedQuestion[],
): Promise<Quiz> {
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO quizzes (id, document_id, model, provider, difficulty, num_questions)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, documentId, model, provider, difficulty, questions.length],
    );

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      await client.query(
        `INSERT INTO quiz_questions (quiz_id, question_index, question, option_a, option_b, option_c, option_d, correct_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, i, q.question, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getQuiz(id) as Promise<Quiz>;
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const quizResult = await pool.query(
    `SELECT q.id, q.document_id, q.model, q.provider, q.difficulty, q.num_questions,
            q.score, q.completed_at, q.created_at,
            d.file_path
     FROM quizzes q
     JOIN documents d ON d.id = q.document_id
     WHERE q.id = $1`,
    [id],
  );

  const row = quizResult.rows[0];
  if (!row) return null;

  const questionsResult = await pool.query(
    `SELECT question_index, question, option_a, option_b, option_c, option_d,
            correct_answer, selected_answer, answered_at
     FROM quiz_questions
     WHERE quiz_id = $1
     ORDER BY question_index ASC`,
    [id],
  );

  const filePath = row.file_path as string;
  const label = sourceLabel(filePath);

  return {
    id: row.id as string,
    documentId: row.document_id as number,
    documentLabel: label,
    model: row.model as string,
    provider: row.provider as string,
    difficulty: row.difficulty as QuizDifficulty,
    numQuestions: row.num_questions as number,
    score: row.score != null ? (row.score as number) : null,
    completedAt: row.completed_at ? new Date(row.completed_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    questions: questionsResult.rows.map((r) => ({
      questionIndex: r.question_index as number,
      question: r.question as string,
      optionA: r.option_a as string,
      optionB: r.option_b as string,
      optionC: r.option_c as string,
      optionD: r.option_d as string,
      correctAnswer: r.correct_answer as AnswerLetter,
      selectedAnswer: (r.selected_answer as AnswerLetter | null) ?? null,
      answeredAt: r.answered_at ? new Date(r.answered_at as string).toISOString() : null,
    })),
  };
}

export async function listQuizzes(): Promise<QuizSummary[]> {
  const result = await pool.query(
    `SELECT q.id, q.document_id, q.model, q.difficulty, q.num_questions, q.score,
            q.completed_at, q.created_at, d.file_path,
            COUNT(qq.selected_answer)::integer AS answered_count
     FROM quizzes q
     JOIN documents d ON d.id = q.document_id
     LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id AND qq.selected_answer IS NOT NULL
     GROUP BY q.id, d.file_path
     ORDER BY q.created_at DESC`,
  );

  return result.rows.map((row) => {
    const filePath = row.file_path as string;
    const label = sourceLabel(filePath);
    return {
      id: row.id as string,
      documentId: row.document_id as number,
      documentLabel: label,
      model: row.model as string,
      difficulty: row.difficulty as string,
      numQuestions: row.num_questions as number,
      score: row.score != null ? (row.score as number) : null,
      completedAt: row.completed_at ? new Date(row.completed_at as string).toISOString() : null,
      createdAt: new Date(row.created_at as string).toISOString(),
      answeredCount: row.answered_count as number,
    };
  });
}

export async function deleteQuiz(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM quizzes WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function answerQuestion(
  quizId: string,
  questionIndex: number,
  selectedAnswer: AnswerLetter | null,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE quiz_questions
     SET selected_answer = $3::text, answered_at = CASE WHEN $3::text IS NOT NULL THEN now() ELSE NULL END
     WHERE quiz_id = $1 AND question_index = $2`,
    [quizId, questionIndex, selectedAnswer],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function restartQuiz(id: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE quiz_questions SET selected_answer = NULL, answered_at = NULL WHERE quiz_id = $1",
      [id],
    );
    await client.query(
      "UPDATE quizzes SET score = NULL, completed_at = NULL WHERE id = $1",
      [id],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeQuiz(id: string): Promise<Quiz | null> {
  const scoreResult = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE selected_answer = correct_answer)::integer AS score
     FROM quiz_questions WHERE quiz_id = $1`,
    [id],
  );
  const score = scoreResult.rows[0]?.score as number;

  await pool.query(
    "UPDATE quizzes SET score = $2, completed_at = now() WHERE id = $1",
    [id, score],
  );

  return getQuiz(id);
}
