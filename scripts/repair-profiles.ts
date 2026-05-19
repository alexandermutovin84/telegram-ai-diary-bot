/**
 * Re-normalize diary_goals and tracking parameters for users with raw/long goals.
 *
 * Usage: npm run repair:profiles
 */
import 'dotenv/config';

import { prisma } from '../src/database/prisma.js';
import { extractOnboardingProfile } from '../src/ai/onboarding-extraction.service.js';
import { normalizeOnboardingExtraction } from '../src/utils/onboarding-normalization.js';
import { looksLikeRawDiaryGoals } from '../src/utils/profile-goals.js';
import { jsonStringArray } from '../src/utils/onboarding-profile-payload.js';
import { applyUserProfilePatch } from '../src/services/user.service.js';
import { logger } from '../src/utils/logger.js';
import { resolveTrackingParameterKey } from '../src/utils/tracking-parameters.js';

function needsRepair(diaryGoals: string | null, tracking: readonly string[]): boolean {
  if (looksLikeRawDiaryGoals(diaryGoals)) {
    return true;
  }
  for (const t of tracking) {
    if (resolveTrackingParameterKey(t) === null && t.trim() !== '') {
      return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  await prisma.$connect();

  const users = await prisma.user.findMany({
    where: {
      OR: [{ diaryGoals: { not: null } }, { trackingParameters: { not: { equals: [] } } }],
    },
  });

  let repaired = 0;
  let skipped = 0;

  for (const user of users) {
    const tracking = jsonStringArray(user.trackingParameters);
    if (!needsRepair(user.diaryGoals, tracking)) {
      skipped += 1;
      continue;
    }

    const sourceText =
      user.diaryGoals?.trim() !== ''
        ? `Нормализуй цели и параметры отслеживания из этой речи пользователя (не копируй дословно):\n${user.diaryGoals}`
        : 'Пользователь уже вёл дневник. Предложи нормализованные цели и tracking keys из контекста профиля.';

    logger.info('repair_profile_start', { userId: user.id, telegramId: user.telegramId.toString() });

    try {
      const extraction = await extractOnboardingProfile({ user, userMessage: sourceText });
      const normalized = normalizeOnboardingExtraction({
        extraction,
        userMessage: sourceText,
        existingTrackingKeys: tracking,
        existingDiaryGoals: user.diaryGoals,
      });
      await applyUserProfilePatch(user.id, normalized.profilePatch);
      repaired += 1;
      logger.info('repair_profile_done', {
        userId: user.id,
        goals: normalized.profilePatch.diaryGoals?.slice(0, 200),
        tracking: normalized.trackingKeys,
      });
    } catch (err) {
      logger.error('repair_profile_failed', err, { userId: user.id });
    }
  }

  console.log(`Repair complete: ${String(repaired)} updated, ${String(skipped)} skipped.`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
