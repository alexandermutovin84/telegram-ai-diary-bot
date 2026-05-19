/**
 * AI onboarding extraction contract (strict JSON from model + validated in code).
 */
export interface ProfileData {
  readonly preferred_name: string | null;
  readonly gender: string | null;
  readonly age: number | null;
  readonly date_of_birth: string | null;
  readonly height_cm: number | null;
  readonly weight_kg: number | null;
  readonly occupation: string | null;
  readonly diary_goals: readonly string[];
  readonly bad_habits: readonly string[];
  readonly health_notes: string | null;
}

export interface OnboardingAiResponse {
  readonly profile_data: ProfileData;
  readonly suggested_tracking_parameters: readonly string[];
  readonly missing_fields: readonly string[];
  readonly follow_up_questions: readonly string[];
  readonly onboarding_complete: boolean;
}

export const EMPTY_PROFILE_DATA: ProfileData = {
  preferred_name: null,
  gender: null,
  age: null,
  date_of_birth: null,
  height_cm: null,
  weight_kg: null,
  occupation: null,
  diary_goals: [],
  bad_habits: [],
  health_notes: null,
};
