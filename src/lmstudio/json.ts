export function stripJsonMarkdownFences(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think>[\s\S]*$/, "")
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .replace(/<\|im_end\|>/g, "")
    .replace(/<\|[a-z_]*\|>/g, "")
    .trim();
}

export function repairTruncatedJsonArray(text: string): string {
  const arrayStart = text.indexOf("[");
  if (arrayStart === -1) throw new Error("No JSON array found in response.");
  const fragment = text.slice(arrayStart);
  const lastCloseBrace = fragment.lastIndexOf("}");
  if (lastCloseBrace === -1) throw new Error("No complete JSON object found.");
  return fragment.slice(0, lastCloseBrace + 1) + "]";
}

export function parseJsonWithRepair<T>(text: string): T {
  const stripped = stripJsonMarkdownFences(text);
  try {
    return JSON.parse(stripped) as T;
  } catch {
    return JSON.parse(repairTruncatedJsonArray(stripped)) as T;
  }
}
