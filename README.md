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

## Running

```bash
bun run dev
```

This starts both the API server and the Svelte UI in watch mode.

- API: `http://localhost:4138`
- UI: `http://localhost:4137`

### Author

Michał Hachuła <michal.hachula@purecode.sh>
