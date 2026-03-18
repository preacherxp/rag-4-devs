import { resolve } from "node:path";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { indexAll } from "./ingest/pipeline.js";
import { watchRagDir } from "./ingest/watcher.js";
import { app } from "./server.js";
import { pool } from "./db/pool.js";

async function main() {
  console.log("[rag] Starting...");

  // 1. Run migrations
  await migrate();

  // 2. Initial indexing
  const ragDir = resolve(config.RAG_DIR);
  console.log(`[rag] Indexing files from ${ragDir}`);
  await indexAll();

  // 3. Watch for changes
  watchRagDir(ragDir);

  // 4. Start server
  const server = Bun.serve({
    port: config.PORT,
    fetch: app.fetch,
  });

  console.log(`[rag] Server running at http://localhost:${server.port}`);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[rag] Shutting down...");
    server.stop();
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[rag] Fatal error:", err);
  process.exit(1);
});
