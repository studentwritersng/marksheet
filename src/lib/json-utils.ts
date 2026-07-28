export function fixJson(raw: string): string {
  if (!raw) return raw;
  let s = raw;

  // 1. Strip markdown code fences — match ```json ... ``` or ``` ... ``` anywhere in string
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }

  // 2. Find the first { or [ to skip any leading text
  const firstBrace = s.search(/[{[]/);
  if (firstBrace > 0) s = s.slice(firstBrace);

  // 3. Fix unclosed quotes
  let esc = false;
  let quoteCount = 0;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') quoteCount++;
  }
  if (quoteCount % 2 !== 0) s += '"';

  // 4. Close unmatched braces/brackets (string-aware)
  const stack: string[] = [];
  let i = 0;
  let inStr = false;
  let escape = false;
  while (i < s.length) {
    const ch = s[i];
    if (escape) { escape = false; i++; continue; }
    if (ch === "\\") { escape = true; i++; continue; }
    if (ch === '"') { inStr = !inStr; i++; continue; }
    if (inStr) { i++; continue; }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" && stack.length > 0 && stack[stack.length - 1] === "{") stack.pop();
    else if (ch === "]" && stack.length > 0 && stack[stack.length - 1] === "[") stack.pop();
    i++;
  }
  for (let j = stack.length - 1; j >= 0; j--) {
    s += stack[j] === "{" ? "}" : "]";
  }

  // 5. Remove trailing commas
  s = s.replace(/,\s*([}\]])/g, "$1");

  return s;
}

export function safeJsonParse<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      return JSON.parse(fixJson(raw)) as T;
    } catch {
      return null;
    }
  }
}
