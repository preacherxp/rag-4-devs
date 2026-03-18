import { watch } from "node:fs";
import { resolve, extname } from "node:path";
import { indexSingleFile, removeFile } from "./pipeline.js";
import { existsSync } from "node:fs";

/**
 * Watch a directory for markdown file changes.
 * Debounces events by 500ms per file.
 */
export function watchRagDir(ragDir: string): void {
  const dir = resolve(ragDir);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  console.log(`[watcher] Watching ${dir}`);

  watch(dir, { recursive: false }, (_event, filename) => {
    if (!filename || extname(filename) !== ".md") return;

    const filePath = resolve(dir, filename);

    // Debounce
    const existing = timers.get(filePath);
    if (existing) clearTimeout(existing);

    timers.set(
      filePath,
      setTimeout(async () => {
        timers.delete(filePath);
        try {
          if (existsSync(filePath)) {
            console.log(`[watcher] Re-indexing ${filename}`);
            await indexSingleFile(filePath);
          } else {
            console.log(`[watcher] File removed ${filename}`);
            await removeFile(filePath);
          }
        } catch (err) {
          console.error(`[watcher] Error processing ${filename}:`, err);
        }
      }, 500),
    );
  });
}
