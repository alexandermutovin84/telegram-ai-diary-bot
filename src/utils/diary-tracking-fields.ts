import type { DiaryStructuredData } from '../types/diary-ai.types.js';
import {
  resolveTrackingParameterKeys,
  trackingParameterLabel,
  type TrackingParameterKey,
} from './tracking-parameters.js';

/** Tier 1 — conversational follow-up (natural questions). */
export const TIER1_TRACKING_KEYS: readonly TrackingParameterKey[] = [
  'mood',
  'stress',
  'energy',
  'sleep',
];

/** Tier 2 — blitz-friendly habits / routines. */
export const TIER2_TRACKING_KEYS: readonly TrackingParameterKey[] = [
  'coffee',
  'smoking',
  'alcohol',
  'bedtime',
  'exercise',
];

/** Tier 3 — blitz-friendly context. */
export const TIER3_TRACKING_KEYS: readonly TrackingParameterKey[] = [
  'screen_time',
  'social_interaction',
  'new_insights',
  'daily_events',
];

const TIER1_SET = new Set<string>(TIER1_TRACKING_KEYS);
const TIER2_SET = new Set<string>(TIER2_TRACKING_KEYS);

type DiaryField = keyof DiaryStructuredData | 'mood_or_emotional';

const TRACKING_TO_FIELD: Partial<Record<TrackingParameterKey, DiaryField>> = {
  mood: 'mood_or_emotional',
  emotional_state: 'emotional_state',
  stress: 'stress_level',
  energy: 'energy_level',
  sleep: 'sleep_quality',
  productivity: 'productivity',
  coffee: 'coffee',
  alcohol: 'alcohol',
  smoking: 'smoking',
  bedtime: 'sleep_quality',
  wake_time: 'sleep_quality',
  exercise: 'physical_state',
  screen_time: 'screen_time',
  social_interaction: 'social_interaction',
  daily_events: 'key_event',
  new_insights: 'what_made_happy',
  physical_state: 'physical_state',
  habits: 'smoking',
};

function scalarPresent(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined) {
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

function isMoodFilled(d: DiaryStructuredData): boolean {
  return scalarPresent(d.mood) || scalarPresent(d.emotional_state);
}

export function isTrackingParameterFilled(
  key: TrackingParameterKey,
  d: DiaryStructuredData,
): boolean {
  const field = TRACKING_TO_FIELD[key];
  if (field === undefined) {
    return true;
  }
  if (field === 'mood_or_emotional') {
    return isMoodFilled(d);
  }
  return scalarPresent(d[field]);
}

export function getMissingEnabledTrackingParams(
  d: DiaryStructuredData,
  enabledKeys: readonly string[],
): TrackingParameterKey[] {
  const enabled = resolveTrackingParameterKeys(enabledKeys);
  return enabled.filter((k) => !isTrackingParameterFilled(k, d));
}

export function tier1Missing(missing: readonly TrackingParameterKey[]): TrackingParameterKey[] {
  return missing.filter((k) => TIER1_SET.has(k));
}

export function blitzEligibleMissing(missing: readonly TrackingParameterKey[]): TrackingParameterKey[] {
  return missing.filter((k) => TIER2_SET.has(k) || TIER3_TRACKING_KEYS.includes(k));
}

export function trackingKeyLabel(key: TrackingParameterKey): string {
  return trackingParameterLabel(key);
}

export function structuredFieldForTrackingKey(
  key: TrackingParameterKey,
): keyof DiaryStructuredData | null {
  const f = TRACKING_TO_FIELD[key];
  if (f === undefined || f === 'mood_or_emotional') {
    return null;
  }
  return f;
}
