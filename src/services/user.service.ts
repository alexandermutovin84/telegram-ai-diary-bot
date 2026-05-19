import type { Prisma, User } from '@prisma/client';

import { prisma } from '../database/prisma.js';

import type { UserProfilePatch } from '../utils/profile.js';

export type UserWithSession = Prisma.UserGetPayload<{
  include: { onboardingSession: true; diarySession: true };
}>;

export async function findUserByTelegramId(
  telegramId: bigint,
): Promise<UserWithSession | null> {
  return prisma.user.findUnique({
    where: { telegramId },
    include: { onboardingSession: true, diarySession: true },
  });
}

export async function ensureUserWithSession(telegramId: bigint): Promise<UserWithSession> {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    include: { onboardingSession: true, diarySession: true },
  });
  if (existing !== null) {
    if (existing.onboardingSession === null) {
      await prisma.onboardingSession.create({
        data: { userId: existing.id, state: 'AWAITING_INITIAL_INTRO' },
      });
      return prisma.user.findUniqueOrThrow({
        where: { id: existing.id },
        include: { onboardingSession: true, diarySession: true },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      telegramId,
      onboardingSession: { create: { state: 'AWAITING_INITIAL_INTRO' } },
    },
    include: { onboardingSession: true, diarySession: true },
  });
}

export async function applyUserProfilePatch(userId: string, patch: UserProfilePatch): Promise<User> {
  const data: Prisma.UserUpdateInput = {};
  if (patch.preferredName !== undefined) {
    data.preferredName = patch.preferredName;
  }
  if (patch.gender !== undefined) {
    data.gender = patch.gender;
  }
  if (patch.age !== undefined) {
    data.age = patch.age;
  }
  if (patch.dateOfBirth !== undefined) {
    data.dateOfBirth = patch.dateOfBirth;
  }
  if (patch.heightCm !== undefined) {
    data.heightCm = patch.heightCm;
  }
  if (patch.weightKg !== undefined) {
    data.weightKg = patch.weightKg;
  }
  if (patch.occupation !== undefined) {
    data.occupation = patch.occupation;
  }
  if (patch.diaryGoals !== undefined) {
    data.diaryGoals = patch.diaryGoals;
  }
  if (patch.badHabits !== undefined) {
    data.badHabits = patch.badHabits;
  }
  if (patch.healthNotes !== undefined) {
    data.healthNotes = patch.healthNotes;
  }
  if (patch.trackingParameters !== undefined) {
    data.trackingParameters = patch.trackingParameters;
  }

  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
