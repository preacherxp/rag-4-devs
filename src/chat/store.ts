import { randomUUID } from "node:crypto";
import { config, DEFAULT_CHAT_MODEL } from "../config.js";
import { pool } from "../db/pool.js";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: string;
  sequence: number;
};

export type ChatSession = {
  id: string;
  model: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type SessionRow = {
  id: string;
  model: string;
  provider: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type MessageRow = {
  role: ChatRole;
  content: string;
  created_at: Date | string;
  sequence: number;
};

function mapMessage(row: MessageRow): ChatMessage {
  return {
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    sequence: row.sequence,
  };
}

async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const result = await pool.query<MessageRow>(
    `SELECT role, content, created_at, sequence
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY sequence ASC`,
    [sessionId],
  );

  return result.rows.map(mapMessage);
}

async function mapSession(row: SessionRow): Promise<ChatSession> {
  return {
    id: row.id,
    model: row.model,
    provider: row.provider,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    messages: await getMessages(row.id),
  };
}

export async function createSession(
  model = DEFAULT_CHAT_MODEL,
  provider = "lmstudio",
): Promise<ChatSession> {
  const id = randomUUID();
  const result = await pool.query<SessionRow>(
    `INSERT INTO chat_sessions (id, model, provider)
     VALUES ($1, $2, $3)
     RETURNING id, model, provider, created_at, updated_at`,
    [id, model, provider],
  );

  return mapSession(result.rows[0]!);
}

export async function getSession(
  sessionId: string,
): Promise<ChatSession | null> {
  const result = await pool.query<SessionRow>(
    `SELECT id, model, provider, created_at, updated_at
     FROM chat_sessions
     WHERE id = $1`,
    [sessionId],
  );

  const row = result.rows[0];
  return row ? mapSession(row) : null;
}

export type ChatSessionSummary = {
  id: string;
  model: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
};

export async function listSessions(limit = 50): Promise<ChatSessionSummary[]> {
  const result = await pool.query<
    SessionRow & { message_count: string; preview: string | null }
  >(
    `SELECT s.id, s.model, s.provider, s.created_at, s.updated_at,
            COUNT(m.sequence)::text AS message_count,
            (SELECT content FROM chat_messages
             WHERE session_id = s.id ORDER BY sequence ASC LIMIT 1) AS preview
     FROM chat_sessions s
     LEFT JOIN chat_messages m ON m.session_id = s.id
     GROUP BY s.id
     ORDER BY s.updated_at DESC, s.created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    model: row.model,
    provider: row.provider,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    messageCount: parseInt(row.message_count, 10),
    preview: row.preview || "",
  }));
}

export async function getLatestSession(): Promise<ChatSession> {
  const result = await pool.query<SessionRow>(
    `SELECT id, model, provider, created_at, updated_at
     FROM chat_sessions
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
  );

  const row = result.rows[0];
  return row ? mapSession(row) : createSession();
}

export async function updateSessionModel(
  sessionId: string,
  model: string,
  provider?: string,
): Promise<ChatSession | null> {
  const result = provider
    ? await pool.query<SessionRow>(
        `UPDATE chat_sessions
         SET model = $2, provider = $3, updated_at = now()
         WHERE id = $1
         RETURNING id, model, provider, created_at, updated_at`,
        [sessionId, model, provider],
      )
    : await pool.query<SessionRow>(
        `UPDATE chat_sessions
         SET model = $2, updated_at = now()
         WHERE id = $1
         RETURNING id, model, provider, created_at, updated_at`,
        [sessionId, model],
      );

  const row = result.rows[0];
  return row ? mapSession(row) : null;
}

export async function appendMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
): Promise<ChatMessage> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionResult = await client.query<{ id: string }>(
      `SELECT id
       FROM chat_sessions
       WHERE id = $1
       FOR UPDATE`,
      [sessionId],
    );

    if (sessionResult.rowCount === 0) {
      throw new Error("Chat session not found");
    }

    const nextSequenceResult = await client.query<{ next_sequence: number }>(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
       FROM chat_messages
       WHERE session_id = $1`,
      [sessionId],
    );

    const sequence = nextSequenceResult.rows[0]!.next_sequence;

    const inserted = await client.query<MessageRow>(
      `INSERT INTO chat_messages (session_id, role, content, sequence)
       VALUES ($1, $2, $3, $4)
       RETURNING role, content, created_at, sequence`,
      [sessionId, role, content, sequence],
    );

    await client.query(
      `UPDATE chat_sessions
       SET updated_at = now()
       WHERE id = $1`,
      [sessionId],
    );

    await client.query("COMMIT");
    return mapMessage(inserted.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM chat_sessions WHERE id = $1`, [
    sessionId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function getRecentMessages(
  sessionId: string,
  limit: number,
  beforeSequence?: number,
): Promise<Array<{ role: ChatRole; content: string }>> {
  const result =
    beforeSequence === undefined
      ? await pool.query<MessageRow>(
          `SELECT role, content, created_at, sequence
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY sequence DESC
         LIMIT $2`,
          [sessionId, limit],
        )
      : await pool.query<MessageRow>(
          `SELECT role, content, created_at, sequence
         FROM chat_messages
         WHERE session_id = $1
           AND sequence < $2
         ORDER BY sequence DESC
         LIMIT $3`,
          [sessionId, beforeSequence, limit],
        );

  return result.rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
  }));
}
