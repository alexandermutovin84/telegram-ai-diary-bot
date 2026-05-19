import type { User } from '@prisma/client';

import type { ProfileData } from '../types/onboarding-ai.types.js';
import { diaryGoalsToStorage, normalizeDiaryGoalsArray } from './profile-goals.js';
import {
  mergeEnabledTrackingParameters,
  trackingKeysToStorage,
  type TrackingParameterKey,
} from './tracking-parameters.js';

const NAME_MAX = 80;
const GENDER_MAX = 80;
const OCC_MAX = 300;
const GOALS_MIN = 3;
const GOALS_MAX = 4000;
const HEALTH_MAX = 2000;
const HABIT_ITEM_MAX = 120;
const MAX_HABITS = 20;

export type RequiredProfileGap =
  | 'preferred_name'
  | 'gender'
  | 'age_or_dob'
  | 'occupation'
  | 'diary_goals';

export interface UserProfilePatch {
  preferredName?: string;
  gender?: string;
  age?: number | null;
  dateOfBirth?: Date | null;
  heightCm?: number;
  weightKg?: number;
  occupation?: string;
  diaryGoals?: string;
  badHabits?: string[];
  healthNotes?: string | null;
  trackingParameters?: string[];
}

function isNonEmptyString(
  value: string | null | undefined,
  minLen: number,
  maxLen: number,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const t = value.trim();
  return t.length >= minLen && t.length <= maxLen;
}

function isValidAge(age: number): boolean {
  return Number.isInteger(age) && age >= 8 && age <= 100;
}

function isValidHeightCm(h: number): boolean {
  return Number.isInteger(h) && h >= 100 && h <= 230;
}

function isValidWeightKg(w: number): boolean {
  return Number.isFinite(w) && w >= 30 && w <= 250;
}

function hasAgeOrDob(user: User): boolean {
  if (user.age !== null && isValidAge(user.age)) {
    return true;
  }
  if (user.dateOfBirth !== null) {
    const d = user.dateOfBirth;
    const now = new Date();
    const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return years >= 8 && years <= 100;
  }
  return false;
}

function diaryGoalsSatisfied(user: User): boolean {
  if (user.diaryGoals === null || user.diaryGoals.trim() === '') {
    return false;
  }
  const t = user.diaryGoals.trim();
  return t.length >= GOALS_MIN && t.length <= GOALS_MAX;
}

export function getRequiredMissingFields(user: User): RequiredProfileGap[] {
  const missing: RequiredProfileGap[] = [];
  if (!isNonEmptyString(user.preferredName, 1, NAME_MAX)) {
    missing.push('preferred_name');
  }
  if (!isNonEmptyString(user.gender, 1, GENDER_MAX)) {
    missing.push('gender');
  }
  if (!hasAgeOrDob(user)) {
    missing.push('age_or_dob');
  }
  if (!isNonEmptyString(user.occupation, 1, OCC_MAX)) {
    missing.push('occupation');
  }
  if (!diaryGoalsSatisfied(user)) {
    missing.push('diary_goals');
  }
  return missing;
}

export function isProfileComplete(user: User): boolean {
  return getRequiredMissingFields(user).length === 0;
}

function clampString(value: string, max: number): string {
  const t = value.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function parseIsoDateOnly(raw: string | null): Date | null {
  if (raw === null) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (m === null) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  return dt;
}

function normalizeHabits(arr: readonly string[]): string[] {
  const out: string[] = [];
  for (const h of arr.slice(0, MAX_HABITS)) {
    const t = clampString(h, HABIT_ITEM_MAX);
    if (t !== '') {
      out.push(t);
    }
  }
  return out;
}

export function normalizeProfileDataToPatch(data: ProfileData): UserProfilePatch {
  const patch: UserProfilePatch = {};

  const name = data.preferred_name;
  if (typeof name === 'string' && isNonEmptyString(name, 1, NAME_MAX)) {
    patch.preferredName = clampString(name, NAME_MAX);
  }

  const gender = data.gender;
  if (typeof gender === 'string' && isNonEmptyString(gender, 1, GENDER_MAX)) {
    patch.gender = clampString(gender, GENDER_MAX);
  }

  const age = data.age;
  if (typeof age === 'number' && isValidAge(age)) {
    patch.age = age;
    patch.dateOfBirth = null;
  } else {
    const dob = parseIsoDateOnly(data.date_of_birth);
    if (dob !== null) {
      patch.dateOfBirth = dob;
      patch.age = null;
    }
  }

  const height = data.height_cm;
  if (typeof height === 'number' && isValidHeightCm(height)) {
    patch.heightCm = height;
  }

  const weight = data.weight_kg;
  if (typeof weight === 'number' && isValidWeightKg(weight)) {
    patch.weightKg = weight;
  }

  const occupation = data.occupation;
  if (typeof occupation === 'string' && isNonEmptyString(occupation, 1, OCC_MAX)) {
    patch.occupation = clampString(occupation, OCC_MAX);
  }

  if (data.diary_goals.length > 0) {
    const stored = diaryGoalsToStorage(normalizeDiaryGoalsArray(data.diary_goals));
    if (stored !== null && stored.length >= GOALS_MIN && stored.length <= GOALS_MAX) {
      patch.diaryGoals = stored;
    }
  }

  const habits = normalizeHabits(data.bad_habits);
  if (habits.length > 0) {
    patch.badHabits = habits;
  }

  const hn = data.health_notes;
  if (typeof hn === 'string' && hn.trim() !== '') {
    patch.healthNotes = clampString(hn, HEALTH_MAX);
  }

  return patch;
}

/** @deprecated Use mergeEnabledTrackingParameters from tracking-parameters.ts */
export function mergeTrackingSuggestions(
  existing: readonly string[],
  suggested: readonly string[],
): string[] {
  return trackingKeysToStorage(mergeEnabledTrackingParameters(existing, suggested));
}

export { mergeEnabledTrackingParameters, type TrackingParameterKey };

export function conversationalFollowUps(gaps: readonly RequiredProfileGap[], max: number): string[] {
  const templates: Record<RequiredProfileGap, string> = {
    preferred_name: 'Как тебе комфортнее, чтобы я обращался по имени?',
    gender: 'Как лучше зафиксировать пол в профиле? Если не хочешь — напиши «не указывать».',
    age_or_dob: 'Сколько тебе полных лет или дата рождения (год-месяц-день)?',
    occupation: 'Чем ты в основном занимаешься — работа, учёба, свой проект? В паре слов.',
    diary_goals: 'Что хочешь от дневника: привычки, настроение, стресс, рефлексия — обозначь своими словами.',
  };
  const out: string[] = [];
  for (const g of gaps) {
    if (out.length >= max) {
      break;
    }
    const q = templates[g];
    out.push(q);
  }
  return out;
}

export const DEFAULT_TRACKING_PARAMETERS_RU: readonly string[] = [
  'сон',
  'настроение',
  'стресс',
  'энергия',
  'продуктивность',
];
