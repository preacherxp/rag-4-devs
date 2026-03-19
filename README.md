# AI Devs 4 RAG

AI Devs 4 RAG is a local retrieval-augmented generation tool with a Svelte UI, Hono API, and pgvector for vector search.

## Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) (for PostgreSQL + pgvector)
- [OpenRouter](https://openrouter.ai/) API key (for embeddings and chat)

## Setup

1. **Install dependencies**

   ```bash
   bun install
   ```

   This installs [Lefthook](https://github.com/evilmartians/lefthook) Git hooks (`pre-commit`: oxlint, `tsc` API + UI, oxfmt check). To run the same checks without staging files: `bun run precommit`. If `lefthook install` complains about `core.hooksPath` (e.g. after migrating from Husky), run `git config --unset-all core.hooksPath` and `bun install` again.

2. **Start PostgreSQL with pgvector**

   ```bash
   docker compose up -d
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your `OPENROUTER_API_KEY`. Other defaults work out of the box with the Docker setup (note: Docker exposes Postgres on port **5433**, so update `DATABASE_URL` accordingly if needed).

4. **Add documents** to the `rag/` directory (configured via `RAG_DIR` in `.env`). Markdown files anywhere under that directory are ingested recursively and indexed for search.

5. **(Optional) Use LM Studio** instead of OpenRouter for local embeddings

   Install [LM Studio](https://lmstudio.ai/), load an embedding model (e.g. `nomic-embed-text`), and update `.env`:

   ```
   EMBED_PROVIDER=lmstudio
   EMBED_MODEL=nomic-embed-text
   EMBED_DIMENSION=768
   ```

## Database migrations

Schema is defined in TypeScript (`src/db/schema.ts`) and versioned SQL lives under `drizzle/`. On startup the app runs [Drizzle’s migrator](https://orm.drizzle.team/docs/migrations) against `DATABASE_URL` (table `drizzle.__drizzle_migrations` tracks what’s applied).

- After editing the schema, regenerate SQL: `bun run db:generate` (set `EMBED_DIMENSION` in `.env` first—the vector column width is baked into the generated migration).
- Optional: `bun run db:studio` for Drizzle Studio.

## Running

```bash
bun run dev
```

This starts both the API server and the Svelte UI in watch mode.

- API: `http://localhost:4138`
- UI: `http://localhost:4137`

### Author

Michał Hachuła <michal.hachula@purecode.sh>
