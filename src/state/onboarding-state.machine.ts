import type { OnboardingState } from '@prisma/client';

export function shouldAcceptOnboardingMessage(
  state: OnboardingState,
  profileComplete: boolean,
): boolean {
  if (state === 'ONBOARDING_COMPLETED' && !profileComplete) {
    return true;
  }
  return state === 'AWAITING_INITIAL_INTRO' || state === 'AWAITING_FOLLOWUP_ANSWERS';
}

export function transitionAfterFirstReply(): OnboardingState {
  return 'AWAITING_FOLLOWUP_ANSWERS';
}

export function transitionOnboardingComplete(): OnboardingState {
  return 'ONBOARDING_COMPLETED';
}
