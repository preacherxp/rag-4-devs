import { describe, expect, test } from "bun:test";
import { chunkMarkdown } from "./chunker.js";

describe("chunkMarkdown", () => {
  test("returns empty array for empty input", () => {
    expect(chunkMarkdown("")).toEqual([]);
    expect(chunkMarkdown("   \n  ")).toEqual([]);
  });

  test("keeps code fences intact in a single chunk when small", () => {
    const md = `# Title

Intro line.

\`\`\`ts
const x = 1;
\`\`\`

Outro.`;
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain("```ts");
    expect(chunks[0]!.content).toContain("const x = 1");
  });

  test("strips image markdown but preserves alt text", () => {
    const md = `# Doc

See ![diagram](https://x/y.png) here.`;
    const chunks = chunkMarkdown(md);
    expect(chunks.some((c) => c.content.includes("diagram"))).toBe(true);
    expect(chunks.every((c) => !c.content.includes("]("))).toBe(true);
  });

  test("assigns monotonic chunkIndex across sections", () => {
    const md = `# A

Para a.

## B

Para b.`;
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(i);
    }
  });
});
