export function parseModelValue(
  value: string,
  defaultProvider: string,
): { provider: string; model: string } {
  const idx = value.indexOf(":");
  if (idx === -1) return { provider: defaultProvider, model: value };
  return { provider: value.slice(0, idx), model: value.slice(idx + 1) };
}
