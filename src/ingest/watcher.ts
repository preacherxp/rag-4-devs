import { existsSync, statSync, watch, type FSWatcher } from "node:fs";
import { relative, resolve } from "node:path";
import {
  isMarkdownFile,
  isPathWithinDir,
  listRagDirectories,
} from "../documents/paths.js";
import { indexAll, indexSingleFile, removeFile } from "./pipeline.js";

/**
 * Watch a directory for markdown file changes.
 * Debounces events by 500ms per file.
 */
export function watchRagDir(ragDir: string): void {
  const dir = resolve(ragDir);
  const fileTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers = new Map<string, FSWatcher>();
  const knownDirs = new Set<string>();
  let syncTimer: ReturnType<typeof setTimeout> | undefined;

  console.log(`[watcher] Watching ${dir}`);

  const isKnownDir = (candidatePath: string): boolean =>
    knownDirs.has(candidatePath) ||
    [...knownDirs].some((knownDir) => isPathWithinDir(knownDir, candidatePath));

  const refreshWatchers = () => {
    const nextDirs = new Set(listRagDirectories(dir));

    for (const watchedDir of watchers.keys()) {
      if (nextDirs.has(watchedDir)) continue;
      watchers.get(watchedDir)?.close();
      watchers.delete(watchedDir);
      knownDirs.delete(watchedDir);
    }

    for (const watchedDir of nextDirs) {
      if (watchers.has(watchedDir)) continue;
      watchers.set(
        watchedDir,
        watch(watchedDir, { recursive: false }, (eventType, filename) => {
          handleEvent(eventType, watchedDir, filename);
        }),
      );
      knownDirs.add(watchedDir);
    }
  };

  const scheduleFullSync = (reason: string) => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      syncTimer = undefined;
      try {
        refreshWatchers();
        console.log(`[watcher] Syncing after ${reason}`);
        await indexAll();
      } catch (err) {
        console.error(`[watcher] Error during sync (${reason}):`, err);
      }
    }, 500);
  };

  const scheduleFileProcess = (filePath: string) => {
    const existing = fileTimers.get(filePath);
    if (existing) clearTimeout(existing);

    fileTimers.set(
      filePath,
      setTimeout(async () => {
        fileTimers.delete(filePath);
        try {
          if (existsSync(filePath)) {
            console.log(
              `[watcher] Re-indexing ${relative(dir, filePath) || filePath}`,
            );
            await indexSingleFile(filePath);
          } else {
            console.log(
              `[watcher] File removed ${relative(dir, filePath) || filePath}`,
            );
            await removeFile(filePath);
          }
        } catch (err) {
          console.error(
            `[watcher] Error processing ${relative(dir, filePath) || filePath}:`,
            err,
          );
        }
      }, 500),
    );
  };

  const handleEvent = (
    eventType: string,
    watchedDir: string,
    filename: string | Buffer | null,
  ) => {
    if (!filename) {
      scheduleFullSync(`unknown change in ${relative(dir, watchedDir) || "."}`);
      return;
    }

    const entryPath = resolve(watchedDir, filename.toString());

    if (isMarkdownFile(entryPath)) {
      if (eventType === "rename") {
        scheduleFullSync(`rename ${relative(dir, entryPath) || entryPath}`);
        return;
      }
      scheduleFileProcess(entryPath);
      return;
    }

    if (existsSync(entryPath) && statSync(entryPath).isDirectory()) {
      scheduleFullSync(`directory change ${relative(dir, entryPath) || entryPath}`);
      return;
    }

    if (eventType === "rename" && isKnownDir(entryPath)) {
      scheduleFullSync(`directory removal ${relative(dir, entryPath) || entryPath}`);
    }
  };

  if (!existsSync(dir)) {
    console.warn(`[watcher] Skipping watch; directory does not exist: ${dir}`);
    return;
  }

  refreshWatchers();
}
