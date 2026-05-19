/**
 * Diary AI extraction contract (strict JSON from model + validated in code).
 */
export interface DiaryStructuredData {
  readonly mood: string | number | null;
  readonly stress_level: string | number | null;
  readonly energy_level: string | number | null;
  readonly sleep_quality: string | number | null;
  readonly productivity: string | number | null;
  readonly physical_state: string | number | null;
  readonly emotional_state: string | number | null;
  readonly coffee: string | number | null;
  readonly alcohol: string | number | null;
  readonly smoking: string | number | null;
  readonly screen_time: string | number | null;
  readonly social_interaction: string | number | null;
  readonly what_made_happy: string | number | null;
  readonly what_upset: string | number | null;
  readonly key_event: string | number | null;
}

export interface DiaryAiResponse {
  readonly structured_data: DiaryStructuredData;
  readonly missing_fields: readonly string[];
  readonly follow_up_questions: readonly string[];
  readonly short_summary: string;
  readonly entry_complete: boolean;
}

export const DIARY_STRUCTURE_KEYS: readonly (keyof DiaryStructuredData)[] = [
  'mood',
  'stress_level',
  'energy_level',
  'sleep_quality',
  'productivity',
  'physical_state',
  'emotional_state',
  'coffee',
  'alcohol',
  'smoking',
  'screen_time',
  'social_interaction',
  'what_made_happy',
  'what_upset',
  'key_event',
] as const;

export const EMPTY_DIARY_STRUCTURED: DiaryStructuredData = {
  mood: null,
  stress_level: null,
  energy_level: null,
  sleep_quality: null,
  productivity: null,
  physical_state: null,
  emotional_state: null,
  coffee: null,
  alcohol: null,
  smoking: null,
  screen_time: null,
  social_interaction: null,
  what_made_happy: null,
  what_upset: null,
  key_event: null,
};
