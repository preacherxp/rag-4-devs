import { existsSync, readdirSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { config } from "../config.js";

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function resolveRagDir(ragDir = config.RAG_DIR): string {
  return resolve(ragDir);
}

export function isMarkdownFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".md";
}

export function isPathWithinDir(filePath: string, dirPath: string): boolean {
  const rel = relative(resolve(dirPath), resolve(filePath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function listMarkdownFiles(ragDir = config.RAG_DIR): string[] {
  const rootDir = resolveRagDir(ragDir);
  const files: string[] = [];

  const walk = (dirPath: string) => {
    const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const entry of entries) {
      const entryPath = resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (entry.isFile() && isMarkdownFile(entry.name)) {
        files.push(entryPath);
      }
    }
  };

  if (!existsSync(rootDir)) {
    return files;
  }

  walk(rootDir);
  return files;
}

export function listRagDirectories(ragDir = config.RAG_DIR): string[] {
  const rootDir = resolveRagDir(ragDir);
  const dirs = [rootDir];

  const walk = (dirPath: string) => {
    const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = resolve(dirPath, entry.name);
      dirs.push(entryPath);
      walk(entryPath);
    }
  };

  if (!existsSync(rootDir)) {
    return dirs;
  }

  walk(rootDir);
  return dirs;
}

export function relativeDocumentPath(
  filePath: string,
  ragDir = config.RAG_DIR,
): string {
  return toPosixPath(relative(resolveRagDir(ragDir), resolve(filePath)));
}

export function sourceLabel(filePath: string, ragDir = config.RAG_DIR): string {
  return relativeDocumentPath(filePath, ragDir).replace(/\.[^.]+$/, "");
}
