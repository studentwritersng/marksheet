export function fixJson(raw: string): string {
  if (!raw) return raw;
  let s = raw;
  s = s.replace(/^```(?:json)?\s*([\s\S]*?)```$/i, "$1").trim();
  const firstBrace = s.search(/[{[]/);
  if (firstBrace > 0) s = s.slice(firstBrace);

  let esc = false;
  let quoteCount = 0;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') quoteCount++;
  }
  if (quoteCount % 2 !== 0) s += '"';

  const unescapedBrackets = (str: string) => {
    const result: string[] = [];
    let i = 0;
    let e = false;
    while (i < str.length) {
      const ch = str[i];
      if (e) { e = false; i++; continue; }
      if (ch === "\\") { e = true; i++; continue; }
      if (ch === '"') {
        i++;
        while (i < str.length) {
          const c2 = str[i];
          if (c2 === "\\") { i += 2; continue; }
          if (c2 === '"') break;
          i++;
        }
        if (i >= str.length) break;
      } else if (ch === "{" || ch === "[") {
        result.push(ch);
      } else if (ch === "}") {
        if (result.length > 0 && result[result.length - 1] === "{") result.pop();
      } else if (ch === "]") {
        if (result.length > 0 && result[result.length - 1] === "[") result.pop();
      }
      i++;
    }
    return result;
  };

  const unmatched = unescapedBrackets(s);
  for (let i = unmatched.length - 1; i >= 0; i--) {
    s += unmatched[i] === "{" ? "}" : "]";
  }

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
