import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const db = drizzle(pool);
  await runMigrations(db, {
    migrationsFolder: resolve(__dirname, "../../drizzle"),
  });
  console.log("[migrate] Schema ready");
}
