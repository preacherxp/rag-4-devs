import { basename } from "node:path";
import type { SearchResult } from "./search.js";

/** Derive a short label from a file path: filename without extension. */
export function sourceLabel(filePath: string): string {
  return basename(filePath).replace(/\.[^.]+$/, "");
}

/** Format search results as XML-tagged context for the LLM prompt. */
export function assembleContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "<context>No relevant documents found.</context>";
  }

  const sources = results
    .map(
      (r) =>
        `<source label="${sourceLabel(r.filePath)}" heading="${r.heading}" similarity="${r.similarity.toFixed(3)}" file="${r.filePath}">\n${r.content}\n</source>`,
    )
    .join("\n\n");

  return `<context>\n${sources}\n</context>`;
}
