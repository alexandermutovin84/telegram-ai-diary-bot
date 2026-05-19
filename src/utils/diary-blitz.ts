import type { DiaryStructuredData } from '../types/diary-ai.types.js';
import { mergeDiaryStructured, structuredDataFromJson } from './diary-completion.js';
import { structuredFieldForTrackingKey, trackingKeyLabel } from './diary-tracking-fields.js';
import type { TrackingParameterKey } from './tracking-parameters.js';

export type BlitzAnswerValue = string | number | boolean;

export interface BlitzParseResult {
  readonly values: Readonly<Record<string, BlitzAnswerValue>>;
}

const BLITZ_LINES: Partial<Record<TrackingParameterKey, string>> = {
  coffee: 'кофе — да / нет',
  alcohol: 'алкоголь — да / нет',
  smoking: 'курение — да / нет',
  exercise: 'спорт — нет / немного / да',
  screen_time: 'экран — мало / средне / много',
  bedtime: 'отбой — рано / норм / поздно (или время)',
  social_interaction: 'общение — мало / норм / много',
  daily_events: 'события — да / нет (кратко)',
  new_insights: 'инсайты — да / нет',
};

export function buildBlitzBlock(missingKeys: readonly TrackingParameterKey[]): string {
  const lines = missingKeys
    .map((k) => BLITZ_LINES[k])
    .filter((line): line is string => line !== undefined);
  if (lines.length === 0) {
    return '';
  }
  return (
    'быстро добью хвост:\n\n' +
    lines.join('\n') +
    '\n\nможно ответить одной строкой'
  );
}

function normalizeBlitzScalar(key: TrackingParameterKey, value: BlitzAnswerValue): string | number {
  if (typeof value === 'boolean') {
    return value ? 'да' : 'нет';
  }
  if (typeof value === 'number') {
    return value;
  }
  const t = value.trim().toLowerCase();
  if (key === 'exercise') {
    if (/нет|no/.test(t)) {
      return 'нет';
    }
    if (/немного|мало|light/.test(t)) {
      return 'немного';
    }
    if (/да|много|high|yes/.test(t)) {
      return 'да';
    }
  }
  if (key === 'screen_time') {
    if (/мало|low/.test(t)) {
      return 'мало';
    }
    if (/средн|medium/.test(t)) {
      return 'средне';
    }
    if (/много|high/.test(t)) {
      return 'много';
    }
  }
  if (value === 'light') {
    return 'немного';
  }
  if (value === 'high') {
    return 'много';
  }
  if (value === 'low') {
    return 'мало';
  }
  return value.trim();
}

/**
 * Rule-based blitz parse for compressed Russian one-liners.
 */
export function parseBlitzByRules(text: string, expectedKeys: readonly TrackingParameterKey[]): BlitzParseResult {
  const values: Record<string, BlitzAnswerValue> = {};
  const lower = text.toLowerCase();

  const patterns: { key: TrackingParameterKey; re: RegExp }[] = [
    { key: 'coffee', re: /кофе\s*[—:-]?\s*(да|нет|yes|no)/i },
    { key: 'alcohol', re: /алкогол\w*\s*[—:-]?\s*(да|нет|yes|no)/i },
    { key: 'smoking', re: /курени\w*\s*[—:-]?\s*(да|нет|yes|no)/i },
    { key: 'exercise', re: /спорт\s*[—:-]?\s*(нет|немного|мало|да|много)/i },
    { key: 'screen_time', re: /экран\w*\s*[—:-]?\s*(мало|средн\w*|много)/i },
  ];

  for (const { key, re } of patterns) {
    if (!expectedKeys.includes(key)) {
      continue;
    }
    const m = lower.match(re);
    if (m?.[1] !== undefined) {
      const v = m[1];
      if (v === 'да' || v === 'yes') {
        values[key] = true;
      } else if (v === 'нет' || v === 'no') {
        values[key] = false;
      } else {
        values[key] = v;
      }
    }
  }

  return { values };
}

export function mergeBlitzIntoStructured(
  base: DiaryStructuredData,
  blitz: Readonly<Record<string, BlitzAnswerValue>>,
): DiaryStructuredData {
  const patch: Record<string, string | number | null> = {};
  for (const [rawKey, rawVal] of Object.entries(blitz)) {
    const key = rawKey as TrackingParameterKey;
    const field = structuredFieldForTrackingKey(key);
    if (field === null) {
      if (key === 'mood' && typeof rawVal === 'string') {
        patch['mood'] = rawVal;
      }
      continue;
    }
    patch[field] = normalizeBlitzScalar(key, rawVal);
  }
  return mergeDiaryStructured(base, structuredDataFromJson(patch));
}

export function blitzKeysForLog(keys: readonly TrackingParameterKey[]): string[] {
  return keys.map((k) => trackingKeyLabel(k));
}
