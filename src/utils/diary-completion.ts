import {
  DIARY_STRUCTURE_KEYS,
  EMPTY_DIARY_STRUCTURED,
  type DiaryStructuredData,
} from '../types/diary-ai.types.js';
import { isTrackingParameterFilled, trackingKeyLabel } from './diary-tracking-fields.js';
import { resolveTrackingParameterKeys, type TrackingParameterKey } from './tracking-parameters.js';

export type CoreDiaryGap =
  | 'mood_or_emotional'
  | 'stress_level'
  | 'energy_level'
  | 'sleep_quality'
  | 'key_event_or_narrative';

function scalarPresent(v: string | number | null): boolean {
  if (v === null) {
    return false;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return true;
  }
  if (typeof v === 'string') {
    return v.trim().length > 0;
  }
  return false;
}

export function mergeDiaryStructured(
  base: DiaryStructuredData,
  incoming: DiaryStructuredData,
): DiaryStructuredData {
  const out: Record<string, string | number | null> = {};
  for (const k of DIARY_STRUCTURE_KEYS) {
    const inc = incoming[k];
    const prev = base[k];
    out[k] = scalarPresent(inc) ? inc : scalarPresent(prev) ? prev : null;
  }
  return out as unknown as DiaryStructuredData;
}

function hasMoodOrEmotional(d: DiaryStructuredData): boolean {
  return scalarPresent(d.mood) || scalarPresent(d.emotional_state);
}

function hasKeyEventOrLongNarrative(d: DiaryStructuredData, combinedTextLen: number): boolean {
  if (scalarPresent(d.key_event)) {
    const s = String(d.key_event).trim();
    return s.length >= 4;
  }
  return combinedTextLen >= 100;
}

export function getCoreDiaryGaps(d: DiaryStructuredData, combinedTextLen: number): CoreDiaryGap[] {
  const gaps: CoreDiaryGap[] = [];
  if (!hasMoodOrEmotional(d)) {
    gaps.push('mood_or_emotional');
  }
  if (!scalarPresent(d.stress_level)) {
    gaps.push('stress_level');
  }
  if (!scalarPresent(d.energy_level)) {
    gaps.push('energy_level');
  }
  if (!scalarPresent(d.sleep_quality)) {
    gaps.push('sleep_quality');
  }
  if (!hasKeyEventOrLongNarrative(d, combinedTextLen)) {
    gaps.push('key_event_or_narrative');
  }
  return gaps;
}

export function isDiaryCoreComplete(d: DiaryStructuredData, combinedTextLen: number): boolean {
  return getCoreDiaryGaps(d, combinedTextLen).length === 0;
}

export function userDeclaresNoMoreDiary(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 4) {
    return false;
  }
  return /хватит|достаточно|не хочу больше|без дописок|всё так|все так|закончим|на этом все|на этом всё|не буду дописывать/.test(t);
}

const GAP_QUESTIONS: Record<CoreDiaryGap, string> = {
  mood_or_emotional:
    'как бы ты описал(а) настроение сегодня — одним словом или короткой фразой?',
  stress_level: 'если оценить стресс от 1 до 5 — сколько было сегодня?',
  energy_level: 'а энергия по шкале 1–5 как ощущалась?',
  sleep_quality: 'сон вчера/сегодня как — можно по шкале 1–5 или своими словами.',
  key_event_or_narrative: 'что было главным событием дня — в одном-двух предложениях?',
};

export function conversationalDiaryFollowUps(gaps: readonly CoreDiaryGap[], max: number): string[] {
  const order: CoreDiaryGap[] = [
    'mood_or_emotional',
    'stress_level',
    'sleep_quality',
    'energy_level',
    'key_event_or_narrative',
  ];
  const out: string[] = [];
  for (const g of order) {
    if (!gaps.includes(g)) {
      continue;
    }
    const q = GAP_QUESTIONS[g];
    if (out.length < max) {
      out.push(q);
    }
  }
  return out;
}

export function structuredDataFromJson(value: unknown): DiaryStructuredData {
  if (typeof value !== 'object' || value === null) {
    return { ...EMPTY_DIARY_STRUCTURED };
  }
  const o = value as Record<string, unknown>;
  const next: Record<string, string | number | null> = {};
  for (const k of DIARY_STRUCTURE_KEYS) {
    const v = o[k];
    if (v === null || v === undefined) {
      next[k] = null;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      next[k] = v;
    } else if (typeof v === 'string') {
      const t = v.trim();
      next[k] = t === '' ? null : t;
    } else {
      next[k] = null;
    }
  }
  return next as unknown as DiaryStructuredData;
}

export function formatDiarySummaryLines(d: DiaryStructuredData): string {
  const mood = scalarPresent(d.mood) ? String(d.mood) : scalarPresent(d.emotional_state) ? String(d.emotional_state) : '—';
  const stress = scalarPresent(d.stress_level) ? String(d.stress_level) : '—';
  const sleep = scalarPresent(d.sleep_quality) ? String(d.sleep_quality) : '—';
  const energy = scalarPresent(d.energy_level) ? String(d.energy_level) : '—';
  return `- настроение: ${mood}\n- стресс: ${stress}\n- сон: ${sleep}\n- энергия: ${energy}`;
}

function displayValueForKey(key: TrackingParameterKey, d: DiaryStructuredData): string {
  if (!isTrackingParameterFilled(key, d)) {
    return '—';
  }
  switch (key) {
    case 'mood':
      return scalarPresent(d.mood) ? String(d.mood) : String(d.emotional_state);
    case 'stress':
      return String(d.stress_level);
    case 'energy':
      return String(d.energy_level);
    case 'sleep':
    case 'bedtime':
      return String(d.sleep_quality);
    case 'productivity':
      return String(d.productivity);
    case 'coffee':
      return String(d.coffee);
    case 'alcohol':
      return String(d.alcohol);
    case 'smoking':
      return String(d.smoking);
    case 'exercise':
      return String(d.physical_state);
    case 'screen_time':
      return String(d.screen_time);
    case 'social_interaction':
      return String(d.social_interaction);
    case 'daily_events':
      return String(d.key_event);
    case 'new_insights':
      return String(d.what_made_happy);
    default:
      return '—';
  }
}

export function formatDiaryCompletionMessage(params: {
  readonly summary: string;
  readonly structured: DiaryStructuredData;
  readonly enabledKeys: readonly string[];
  readonly missingParameters: readonly TrackingParameterKey[];
}): string {
  const short = params.summary.trim() !== '' ? params.summary.trim() : 'день записан.';
  const enabled = resolveTrackingParameterKeys(params.enabledKeys);

  const understood: string[] = [];
  if (scalarPresent(params.structured.key_event)) {
    understood.push(`— ${String(params.structured.key_event)}`);
  }
  if (scalarPresent(params.structured.what_made_happy)) {
    understood.push(`— ${String(params.structured.what_made_happy)}`);
  }
  const understoodBlock = understood.length > 0 ? understood.join('\n') : `— ${short}`;

  const displayKeys = enabled.filter(
    (k) =>
      k === 'mood' ||
      k === 'stress' ||
      k === 'energy' ||
      k === 'sleep' ||
      isTrackingParameterFilled(k, params.structured) ||
      params.missingParameters.includes(k),
  );

  const paramBlock = displayKeys
    .map((k) => `${trackingKeyLabel(k)}: ${displayValueForKey(k, params.structured)}`)
    .join('\n');

  const missingBlock =
    params.missingParameters.length > 0
      ? '\n\nпока не хватает:\n' +
        params.missingParameters.map((k) => `○ ${trackingKeyLabel(k)}`).join('\n')
      : '';

  return (
    `записал.\n\nчто я понял:\n${understoodBlock}\n\nпо параметрам:\n${paramBlock}${missingBlock}\n\nможно дописать позже.`
  );
}

export function userSkipsBlitz(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '' || /^(пропуст|скип|skip|не знаю|позже)$/.test(t);
}
