import {
  DIARY_STRUCTURE_KEYS,
  EMPTY_DIARY_STRUCTURED,
  type DiaryAiResponse,
  type DiaryStructuredData,
} from '../../types/diary-ai.types.js';

function asNullableScalar(value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  return null;
}

function normalizeStructuredData(value: unknown): DiaryStructuredData {
  if (typeof value !== 'object' || value === null) {
    return { ...EMPTY_DIARY_STRUCTURED };
  }
  const o = value as Record<string, unknown>;
  const out: Record<string, string | number | null> = {};
  for (const k of DIARY_STRUCTURE_KEYS) {
    out[k] = asNullableScalar(o[k]);
  }
  return out as unknown as DiaryStructuredData;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const res: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t !== '') {
        res.push(t);
      }
    }
  }
  return res;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function validateDiaryAiResponse(value: unknown): DiaryAiResponse | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const root = value as Record<string, unknown>;
  return {
    structured_data: normalizeStructuredData(root['structured_data']),
    missing_fields: asStringArray(root['missing_fields']),
    follow_up_questions: asStringArray(root['follow_up_questions']),
    short_summary: asString(root['short_summary'], ''),
    entry_complete: asBool(root['entry_complete'], false),
  };
}
