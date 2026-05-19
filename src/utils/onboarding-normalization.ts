import type { OnboardingAiResponse } from '../types/onboarding-ai.types.js';
import type { UserProfilePatch } from './profile.js';
import { normalizeProfileDataToPatch } from './profile.js';
import {
  diaryGoalsToStorage,
  normalizeDiaryGoalsArray,
  parseDiaryGoalsFromStorage,
} from './profile-goals.js';
import {
  mergeEnabledTrackingParameters,
  trackingKeysToStorage,
  type TrackingParameterKey,
} from './tracking-parameters.js';

export interface NormalizedOnboardingResult {
  readonly profilePatch: UserProfilePatch;
  readonly trackingKeys: readonly TrackingParameterKey[];
}

/**
 * Server-side normalization after AI extraction: goals, tracking keys, no raw transcript.
 */
export function normalizeOnboardingExtraction(params: {
  readonly extraction: OnboardingAiResponse;
  readonly userMessage: string;
  readonly existingTrackingKeys: readonly string[];
  readonly existingDiaryGoals: string | null;
}): NormalizedOnboardingResult {
  const profilePatch = normalizeProfileDataToPatch(params.extraction.profile_data);

  const mergedGoals = normalizeDiaryGoalsArray([
    ...parseDiaryGoalsFromStorage(params.existingDiaryGoals),
    ...params.extraction.profile_data.diary_goals,
  ]);
  const goalsStorage = diaryGoalsToStorage(mergedGoals);
  if (goalsStorage !== null) {
    profilePatch.diaryGoals = goalsStorage;
  }

  const trackingKeys = mergeEnabledTrackingParameters(
    params.existingTrackingKeys,
    params.extraction.suggested_tracking_parameters,
    { inferFromText: params.userMessage },
  );

  profilePatch.trackingParameters = trackingKeysToStorage(trackingKeys);

  return { profilePatch, trackingKeys };
}

export function normalizeStoredTrackingKeys(raw: readonly string[]): TrackingParameterKey[] {
  return mergeEnabledTrackingParameters(raw, [], {});
}
