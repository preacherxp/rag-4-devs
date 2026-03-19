import { describe, expect, test } from "bun:test";
import {
  extractTocFromMarkdown,
  prettyDocumentLabel,
  prettyPathSegment,
  prettyPreviewTitle,
  slugifyForAnchor,
  slugifyWithDedup,
} from "./previewFormat.js";

describe("slugifyForAnchor", () => {
  test("normalizes unicode and punctuation", () => {
    expect(slugifyForAnchor("  Hello — World!!  ")).toBe("hello-world");
  });

  test("falls back to section when empty", () => {
    expect(slugifyForAnchor("@@@")).toBe("section");
  });
});

describe("extractTocFromMarkdown", () => {
  test("dedupes duplicate heading slugs", () => {
    const toc = extractTocFromMarkdown("# Same\n\n## Same\n");
    expect(toc.map((h) => h.slug)).toEqual(["same", "same-1"]);
  });

  test("strips trailing hashes in heading text", () => {
    const toc = extractTocFromMarkdown("## Title ##\n");
    expect(toc[0]!.text).toBe("Title");
  });
});

describe("prettyPathSegment", () => {
  test("formats sNNeNN episode slug", () => {
    expect(prettyPathSegment("s2e4-foo-bar")).toBe("S02E04 · Foo Bar");
  });

  test("strips long numeric suffix", () => {
    expect(prettyPathSegment("episode-name-1773309028")).toBe("Episode Name");
  });
});

describe("prettyDocumentLabel", () => {
  test("joins segments with separator", () => {
    expect(prettyDocumentLabel("docs/quick-start")).toBe("Docs › Quick Start");
  });
});

describe("prettyPreviewTitle", () => {
  test("uses default title for blank label", () => {
    expect(prettyPreviewTitle("  ")).toBe("Document Preview");
  });
});

describe("slugifyWithDedup", () => {
  test("appends counter on collision", () => {
    const used = new Set<string>();
    expect(slugifyWithDedup("Foo", used)).toBe("foo");
    expect(slugifyWithDedup("Foo", used)).toBe("foo-1");
  });
});
