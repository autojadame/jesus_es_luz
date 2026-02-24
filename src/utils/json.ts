export function extractJsonArray(raw: string): string {
  const s = String(raw ?? "");
  const i = s.indexOf("[");
  const j = s.lastIndexOf("]");
  if (i < 0 || j < 0 || j <= i) throw new Error("No JSON array brackets found");
  return s.slice(i, j + 1);
}

export function extractJsonObject(raw: string): string {
  const s = String(raw ?? "");
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i < 0 || j < 0 || j <= i) throw new Error("No JSON object braces found");
  return s.slice(i, j + 1);
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}