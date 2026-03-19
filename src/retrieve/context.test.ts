import { expect, test } from "bun:test";
import { assembleContext } from "./context.js";

test("assembleContext returns placeholder when no results", () => {
  expect(assembleContext([])).toBe("<context>No relevant documents found.</context>");
});
