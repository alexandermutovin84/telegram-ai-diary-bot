import {
  EMPTY_PROFILE_DATA,
  type OnboardingAiResponse,
  type ProfileData,
} from '../../types/onboarding-ai.types.js';
import { normalizeDiaryGoalsArray } from '../../utils/profile-goals.js';
import { resolveTrackingParameterKeys } from '../../utils/tracking-parameters.js';

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const t = value.trim();
  return t === '' ? null : t;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t !== '') {
        out.push(t);
      }
    }
  }
  return out;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeProfileData(value: unknown): ProfileData {
  if (typeof value !== 'object' || value === null) {
    return { ...EMPTY_PROFILE_DATA };
  }
  const o = value as Record<string, unknown>;
  const goals = normalizeDiaryGoalsArray(asStringArray(o['diary_goals']));
  const habits = asStringArray(o['bad_habits']);
  return {
    preferred_name: asNullableString(o['preferred_name']),
    gender: asNullableString(o['gender']),
    age: asNullableNumber(o['age']),
    date_of_birth: asNullableString(o['date_of_birth']),
    height_cm: asNullableNumber(o['height_cm']),
    weight_kg: asNullableNumber(o['weight_kg']),
    occupation: asNullableString(o['occupation']),
    diary_goals: goals,
    bad_habits: habits,
    health_notes: asNullableString(o['health_notes']),
  };
}

/**
 * Returns null if the object cannot be coerced into the expected onboarding AI shape.
 */
export function validateOnboardingAiResponse(value: unknown): OnboardingAiResponse | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const root = value as Record<string, unknown>;
  const profile_data = normalizeProfileData(root['profile_data']);
  const suggestedRaw = asStringArray(root['suggested_tracking_parameters']);
  const suggestedKeys = resolveTrackingParameterKeys(suggestedRaw);
  return {
    profile_data,
    suggested_tracking_parameters: suggestedKeys,
    missing_fields: asStringArray(root['missing_fields']),
    follow_up_questions: asStringArray(root['follow_up_questions']),
    onboarding_complete: asBool(root['onboarding_complete'], false),
  };
}
