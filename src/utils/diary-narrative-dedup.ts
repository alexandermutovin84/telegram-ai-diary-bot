import type { DiaryStructuredData } from '../types/diary-ai.types.js';

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  const words = normalizeForCompare(s).split(' ').filter((w) => w.length > 1);
  return new Set(words);
}

/** Почти одно и то же событие разными формулировками (типично key_event vs what_made_happy). */
export function narrativesAreNearDuplicate(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === '' || nb === '') {
    return false;
  }
  if (na === nb) {
    return true;
  }
  if (na.length >= 10 && nb.length >= 10 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) {
    return false;
  }
  let common = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      common += 1;
    }
  }
  const ratio = common / Math.max(ta.size, tb.size);
  return ratio >= 0.75;
}

export function dedupeNarrativeBullets(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === '') {
      continue;
    }
    if (out.some((prev) => narrativesAreNearDuplicate(prev, t))) {
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Убирает дубли смысла между полями narrative после ответа модели. */
export function collapseDuplicateDiaryNarratives(
  structured: DiaryStructuredData,
): DiaryStructuredData {
  const key =
    structured.key_event !== null && typeof structured.key_event === 'string'
      ? structured.key_event.trim()
      : '';
  const happy =
    structured.what_made_happy !== null && typeof structured.what_made_happy === 'string'
      ? String(structured.what_made_happy).trim()
      : '';
  const upset =
    structured.what_upset !== null && typeof structured.what_upset === 'string'
      ? String(structured.what_upset).trim()
      : '';

  let what_made_happy = structured.what_made_happy;
  let what_upset = structured.what_upset;

  if (key !== '' && happy !== '' && narrativesAreNearDuplicate(key, happy)) {
    what_made_happy = null;
  }
  if (key !== '' && upset !== '' && narrativesAreNearDuplicate(key, upset)) {
    what_upset = null;
  }
  if (happy !== '' && upset !== '' && narrativesAreNearDuplicate(happy, upset)) {
    what_upset = null;
  }

  if (what_made_happy === structured.what_made_happy && what_upset === structured.what_upset) {
    return structured;
  }
  return { ...structured, what_made_happy, what_upset };
}
