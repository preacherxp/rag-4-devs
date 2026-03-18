CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE
  IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    file_path TEXT UNIQUE NOT NULL,
    checksum TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  );


CREATE TABLE
  IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );


CREATE TABLE
  IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence INTEGER NOT NULL,
    UNIQUE (session_id, sequence)
  );


CREATE TABLE
  IF NOT EXISTS chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    heading TEXT,
    content TEXT NOT NULL,
    embedding vector({dimension}),
    UNIQUE (document_id, chunk_index)
  );


CREATE TABLE
  IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    model TEXT NOT NULL DEFAULT 'google/gemini-3.1-flash-lite-preview',
    provider TEXT NOT NULL DEFAULT 'openrouter',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    num_questions INTEGER NOT NULL,
    score INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );


CREATE TABLE
  IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    selected_answer TEXT CHECK (SELECTed_answer IN ('A', 'B', 'C', 'D')),
    answered_at TIMESTAMPTZ,
    UNIQUE (quiz_id, question_index)
  );