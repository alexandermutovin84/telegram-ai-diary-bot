import type { User } from '@prisma/client';

export function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function diaryGoalsToArray(diaryGoals: string | null): string[] {
  if (diaryGoals === null || diaryGoals.trim() === '') {
    return [];
  }
  return diaryGoals
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * Snapshot sent to the extraction model as current_profile.
 */
export function userToAiCurrentProfilePayload(user: User): Record<string, unknown> {
  const dob =
    user.dateOfBirth !== null ? user.dateOfBirth.toISOString().slice(0, 10) : null;
  return {
    profile_data: {
      preferred_name: user.preferredName,
      gender: user.gender,
      age: user.age,
      date_of_birth: dob,
      height_cm: user.heightCm,
      weight_kg: user.weightKg,
      occupation: user.occupation,
      diary_goals: diaryGoalsToArray(user.diaryGoals),
      bad_habits: jsonStringArray(user.badHabits),
      health_notes: user.healthNotes,
    },
    existing_tracking_parameters: jsonStringArray(user.trackingParameters),
  };
}
