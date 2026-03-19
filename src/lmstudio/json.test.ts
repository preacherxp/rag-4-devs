import { describe, expect, test } from "bun:test";
import { parseJsonWithRepair, repairTruncatedJsonArray, stripJsonMarkdownFences } from "./json.js";

describe("stripJsonMarkdownFences", () => {
  test("removes markdown code fences", () => {
    expect(stripJsonMarkdownFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonMarkdownFences("```\n[1]\n```")).toBe("[1]");
  });

  test("removes closed think blocks including inner text", () => {
    expect(stripJsonMarkdownFences('<think>{"x":true}</think>')).toBe("");
  });

  test("removes unclosed think through end of string", () => {
    expect(stripJsonMarkdownFences('<think>here\n{"a":1}')).toBe("");
  });

  test("leaves JSON after a closed think block", () => {
    expect(stripJsonMarkdownFences('<think>done</think>\n{"ok":true}')).toBe('{"ok":true}');
  });
});

describe("repairTruncatedJsonArray", () => {
  test("closes truncated array after last complete object", () => {
    const text = 'noise [{"a":1},{"b":2},';
    expect(repairTruncatedJsonArray(text)).toBe('[{"a":1},{"b":2}]');
  });

  test("throws when no array start", () => {
    expect(() => repairTruncatedJsonArray("{}")).toThrow("No JSON array");
  });
});

describe("parseJsonWithRepair", () => {
  test("parses clean JSON", () => {
    expect(parseJsonWithRepair<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("repairs truncated array when direct parse fails", () => {
    const raw = '```\n[{"id":1},{"id":2}\n';
    expect(parseJsonWithRepair<{ id: number }[]>(raw)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
