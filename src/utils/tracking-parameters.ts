/**
 * Canonical tracking parameter keys (stored in DB) and Russian labels (shown to user).
 *
 * @example Test: extract + merge from onboarding speech
 * Input: "я хочу отслеживать настроение, курение, кофе, алкоголь, во сколько ложусь, события дня и что нового узнал"
 * Expected enabled keys (with defaults):
 * mood, stress, energy, productivity, sleep, smoking, coffee, alcohol, bedtime, daily_events, new_insights
 */
export const TRACKING_PARAMETER_KEYS = [
  'mood',
  'stress',
  'energy',
  'productivity',
  'sleep',
  'bedtime',
  'wake_time',
  'coffee',
  'alcohol',
  'smoking',
  'sugar',
  'nutrition',
  'exercise',
  'screen_time',
  'social_interaction',
  'daily_events',
  'new_insights',
  'physical_state',
  'emotional_state',
  'habits',
] as const;

export type TrackingParameterKey = (typeof TRACKING_PARAMETER_KEYS)[number];

export const DEFAULT_CORE_TRACKING_KEYS: readonly TrackingParameterKey[] = [
  'mood',
  'stress',
  'energy',
  'productivity',
  'sleep',
];

const LABELS: Record<TrackingParameterKey, string> = {
  mood: 'настроение',
  stress: 'стресс',
  energy: 'энергия',
  productivity: 'продуктивность',
  sleep: 'сон',
  bedtime: 'время отхода ко сну',
  wake_time: 'время подъёма',
  coffee: 'кофе',
  alcohol: 'алкоголь',
  smoking: 'курение',
  sugar: 'сладкое',
  nutrition: 'питание',
  exercise: 'спорт / активность',
  screen_time: 'экранное время',
  social_interaction: 'живое общение',
  daily_events: 'события дня',
  new_insights: 'что нового узнал',
  physical_state: 'физическое состояние',
  emotional_state: 'эмоциональный фон',
  habits: 'привычки',
};

/** Russian label → canonical key (includes legacy stored labels). */
const LABEL_TO_KEY: ReadonlyMap<string, TrackingParameterKey> = buildLabelToKeyMap();

function buildLabelToKeyMap(): ReadonlyMap<string, TrackingParameterKey> {
  const map = new Map<string, TrackingParameterKey>();
  for (const key of TRACKING_PARAMETER_KEYS) {
    map.set(key, key);
    map.set(LABELS[key].toLowerCase(), key);
  }
  map.set('качество сна', 'sleep');
  map.set('сон', 'sleep');
  map.set('настроение', 'mood');
  map.set('стресс', 'stress');
  map.set('энергия', 'energy');
  map.set('продуктивность', 'productivity');
  return map;
}

/** Substring / phrase hints in free text → key */
const TEXT_HINTS: readonly { readonly pattern: RegExp; readonly key: TrackingParameterKey }[] = [
  { pattern: /курени|курю|курит|сигарет/i, key: 'smoking' },
  { pattern: /кофе/i, key: 'coffee' },
  { pattern: /алкогол/i, key: 'alcohol' },
  { pattern: /ложусь|отход ко сну|во сколько спать|засыпа/i, key: 'bedtime' },
  { pattern: /подъ?[её]м|просыпа/i, key: 'wake_time' },
  { pattern: /\bсон\b|спал[аи]?|качество сна/i, key: 'sleep' },
  { pattern: /настроени/i, key: 'mood' },
  { pattern: /стресс/i, key: 'stress' },
  { pattern: /энерги/i, key: 'energy' },
  { pattern: /продуктив/i, key: 'productivity' },
  { pattern: /экранн|телефон|соцсет/i, key: 'screen_time' },
  { pattern: /общени|социальн/i, key: 'social_interaction' },
  { pattern: /события дня|событий дня|\bсобытия\b/i, key: 'daily_events' },
  { pattern: /что нового|новые мысли|инсайт|узнал/i, key: 'new_insights' },
  { pattern: /тренд|аналитик/i, key: 'mood' },
  { pattern: /привычк/i, key: 'habits' },
  { pattern: /сладк|сахар/i, key: 'sugar' },
  { pattern: /питани|еда\b|питаюсь/i, key: 'nutrition' },
  { pattern: /спорт|трениров|активност/i, key: 'exercise' },
  { pattern: /физическ/i, key: 'physical_state' },
  { pattern: /эмоцион/i, key: 'emotional_state' },
];

export function trackingParameterLabel(key: TrackingParameterKey): string {
  return LABELS[key];
}

export function isTrackingParameterKey(value: string): value is TrackingParameterKey {
  return (TRACKING_PARAMETER_KEYS as readonly string[]).includes(value);
}

export function resolveTrackingParameterKey(raw: string): TrackingParameterKey | null {
  const t = raw.trim().toLowerCase();
  if (t === '') {
    return null;
  }
  if (isTrackingParameterKey(t)) {
    return t;
  }
  const fromLabel = LABEL_TO_KEY.get(t);
  if (fromLabel !== undefined) {
    return fromLabel;
  }
  for (const key of TRACKING_PARAMETER_KEYS) {
    if (LABELS[key].toLowerCase().includes(t) || t.includes(LABELS[key].toLowerCase())) {
      return key;
    }
  }
  return null;
}

export function extractTrackingKeysFromText(text: string): TrackingParameterKey[] {
  const found = new Set<TrackingParameterKey>();
  for (const { pattern, key } of TEXT_HINTS) {
    if (pattern.test(text)) {
      found.add(key);
    }
  }
  return [...found];
}

export function resolveTrackingParameterKeys(raw: readonly string[]): TrackingParameterKey[] {
  const out = new Set<TrackingParameterKey>();
  for (const item of raw) {
    const key = resolveTrackingParameterKey(item);
    if (key !== null) {
      out.add(key);
    }
  }
  return sortTrackingKeys([...out]);
}

export function mergeEnabledTrackingParameters(
  existing: readonly string[],
  suggested: readonly string[],
  options?: { readonly inferFromText?: string },
): TrackingParameterKey[] {
  const keys = new Set<TrackingParameterKey>(DEFAULT_CORE_TRACKING_KEYS);
  for (const k of resolveTrackingParameterKeys(existing)) {
    keys.add(k);
  }
  for (const k of resolveTrackingParameterKeys(suggested)) {
    keys.add(k);
  }
  if (options?.inferFromText !== undefined && options.inferFromText.trim() !== '') {
    for (const k of extractTrackingKeysFromText(options.inferFromText)) {
      keys.add(k);
    }
  }
  return sortTrackingKeys([...keys]);
}

export function sortTrackingKeys(keys: readonly TrackingParameterKey[]): TrackingParameterKey[] {
  const order = new Map(TRACKING_PARAMETER_KEYS.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

export function formatTrackingKeysForDisplay(keys: readonly string[]): string[] {
  const resolved = resolveTrackingParameterKeys(keys);
  if (resolved.length === 0) {
    return DEFAULT_CORE_TRACKING_KEYS.map((k) => trackingParameterLabel(k));
  }
  return resolved.map((k) => trackingParameterLabel(k));
}

/** Keys for persistence in JSON column */
export function trackingKeysToStorage(keys: readonly TrackingParameterKey[]): string[] {
  return sortTrackingKeys([...new Set(keys)]);
}

export const TRACKING_PARAMETER_CATALOG_FOR_PROMPT = TRACKING_PARAMETER_KEYS.map(
  (k) => `${k} → ${LABELS[k]}`,
).join('\n');
