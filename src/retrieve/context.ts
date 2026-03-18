import type { SearchResult } from "./search.js";
import { sourceLabel } from "../documents/paths.js";
export { sourceLabel } from "../documents/paths.js";

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
