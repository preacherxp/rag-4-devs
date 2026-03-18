import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  listMarkdownFiles,
  listRagDirectories,
  relativeDocumentPath,
  sourceLabel,
} from "./paths.js";

let tempDirs: string[] = [];

function createTempRagDir(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "rag-paths-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("document path helpers", () => {
  test("recursively lists nested markdown files in stable order", () => {
    const ragDir = createTempRagDir();
    mkdirSync(resolve(ragDir, "docs/core"), { recursive: true });
    mkdirSync(resolve(ragDir, "docs/api"), { recursive: true });

    writeFileSync(resolve(ragDir, "root.md"), "# root");
    writeFileSync(resolve(ragDir, "docs/core/index.md"), "# core");
    writeFileSync(resolve(ragDir, "docs/api/reference.md"), "# api");

    const files = listMarkdownFiles(ragDir).map((filePath) =>
      relativeDocumentPath(filePath, ragDir),
    );

    expect(files).toEqual([
      "docs/api/reference.md",
      "docs/core/index.md",
      "root.md",
    ]);
  });

  test("ignores non-markdown files and still tracks nested directories", () => {
    const ragDir = createTempRagDir();
    mkdirSync(resolve(ragDir, "docs/images"), { recursive: true });

    writeFileSync(resolve(ragDir, "docs/images/logo.png"), "png");
    writeFileSync(resolve(ragDir, "docs/images/readme.txt"), "txt");
    writeFileSync(resolve(ragDir, "docs/images/guide.md"), "# guide");

    expect(
      listMarkdownFiles(ragDir).map((filePath) =>
        relativeDocumentPath(filePath, ragDir),
      ),
    ).toEqual(["docs/images/guide.md"]);

    expect(listRagDirectories(ragDir).map((dirPath) => relativeDocumentPath(dirPath, ragDir))).toEqual([
      "",
      "docs",
      "docs/images",
    ]);
  });

  test("derives distinct labels for same-named files in different folders", () => {
    const ragDir = createTempRagDir();
    mkdirSync(resolve(ragDir, "docs/a"), { recursive: true });
    mkdirSync(resolve(ragDir, "docs/b"), { recursive: true });

    const first = resolve(ragDir, "docs/a/index.md");
    const second = resolve(ragDir, "docs/b/index.md");

    writeFileSync(first, "# a");
    writeFileSync(second, "# b");

    expect(sourceLabel(first, ragDir)).toBe("docs/a/index");
    expect(sourceLabel(second, ragDir)).toBe("docs/b/index");
  });

  test("normalizes nested labels to forward-slash relative paths", () => {
    const ragDir = createTempRagDir();
    mkdirSync(resolve(ragDir, "guides/nested"), { recursive: true });
    const filePath = resolve(ragDir, "guides/nested/quick-start.md");
    writeFileSync(filePath, "# quick");

    expect(relativeDocumentPath(filePath, ragDir)).toBe(
      "guides/nested/quick-start.md",
    );
    expect(sourceLabel(filePath, ragDir)).toBe("guides/nested/quick-start");
  });
});
