/**
 * Extract and parse JSON from model output (may include markdown or prose).
 */

function stripCodeFences(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im;
  const m = fence.exec(t);
  if (m !== null) {
    const inner = m[1];
    if (inner !== undefined) {
      t = inner.trim();
    }
  }
  return t;
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function tryParseJson(raw: string): { readonly parsed: unknown } | null {
  try {
    return { parsed: JSON.parse(raw) };
  } catch {
    return null;
  }
}

/** Remove trailing commas before } or ] (common model mistake). */
function relaxJsonText(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1');
}

export type ModelJsonParse =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

export function parseJsonFromModelOutput(raw: string): ModelJsonParse {
  const stripped = stripCodeFences(raw);
  const candidates = [stripped, extractBalancedJsonObject(stripped) ?? stripped];
  for (const c of candidates) {
    const relaxed = relaxJsonText(c.trim());
    const wrapped = tryParseJson(relaxed);
    if (wrapped !== null) {
      return { ok: true, value: wrapped.parsed };
    }
  }
  return { ok: false };
}
