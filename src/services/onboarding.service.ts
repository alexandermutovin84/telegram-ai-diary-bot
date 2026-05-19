import type { Context } from 'telegraf';

import { extractOnboardingProfile } from '../ai/onboarding-extraction.service.js';
import { mainMenuReply } from '../bot/main-menu.keyboard.js';
import { prisma } from '../database/prisma.js';
import {
  shouldAcceptOnboardingMessage,
  transitionAfterFirstReply,
  transitionOnboardingComplete,
} from '../state/onboarding-state.machine.js';
import { logger } from '../utils/logger.js';
import { jsonStringArray } from '../utils/onboarding-profile-payload.js';
import { normalizeOnboardingExtraction } from '../utils/onboarding-normalization.js';
import {
  conversationalFollowUps,
  getRequiredMissingFields,
  isProfileComplete,
  type RequiredProfileGap,
} from '../utils/profile.js';
import { formatTrackingKeysForDisplay } from '../utils/tracking-parameters.js';
import { replyForInboundResolveError, resolveInboundText } from './inbound-text.service.js';
import {
  applyUserProfilePatch,
  ensureUserWithSession,
  findUserByTelegramId,
  type UserWithSession,
} from './user.service.js';

const ONBOARDING_INTRO_RU =
  'Привет. Я помогу тебе вести дневник.\n\n' +
  'Расскажи о себе текстом или голосом: как к тебе обращаться, пол, возраст или дату рождения, чем занимаешься ' +
  'и чего хочешь от дневника. Рост, вес, привычки и здоровье — по желанию.';

function welcomeBackMessage(user: UserWithSession): string {
  const name = user.preferredName?.trim();
  if (name !== undefined && name !== '') {
    return `С возвращением, ${name}! Можно продолжать вести дневник.`;
  }
  return 'С возвращением! Можно продолжать вести дневник.';
}

function buildOnboardingDoneMessage(tracking: readonly string[]): string {
  const lines = tracking.map((t) => `- ${t}`).join('\n');
  return (
    'готово. я собрал базовый профиль.\n\n' +
    'предлагаю начать отслеживать:\n' +
    `${lines}\n\n` +
    'теперь можно записать первый дневник.'
  );
}

function buildResumeMessage(user: UserWithSession): string {
  const stored = user.onboardingSession?.lastFollowUp?.trim() ?? '';
  const follow =
    stored !== ''
      ? stored
      : 'Расскажи недостающее текстом или голосом — можно короткими ответами.';
  return `Продолжим настройку профиля.\n\n${follow}`;
}

function buildFollowUpBlock(
  extractionFollowUps: readonly string[],
  requiredMissing: readonly RequiredProfileGap[],
): string {
  const fromAi = extractionFollowUps
    .map((q) => q.trim())
    .filter((q) => q !== '')
    .slice(0, 3);
  if (fromAi.length > 0) {
    return fromAi.join('\n\n');
  }
  return conversationalFollowUps(requiredMissing, 3).join('\n\n');
}

async function reloadUser(telegramId: bigint): Promise<UserWithSession> {
  const fresh = await findUserByTelegramId(telegramId);
  if (fresh === null) {
    throw new Error('User disappeared after update');
  }
  return fresh;
}

function isFullyOnboarded(user: UserWithSession): boolean {
  return (
    user.onboardingSession?.state === 'ONBOARDING_COMPLETED' && isProfileComplete(user)
  );
}

export const onboardingFlowService = {
  async handleStart(ctx: Context): Promise<void> {
    if (ctx.from === undefined) {
      await ctx.reply('Не удалось определить пользователя Telegram.');
      return;
    }

    const telegramId = BigInt(ctx.from.id);
    const existing = await findUserByTelegramId(telegramId);

    if (existing !== null && isFullyOnboarded(existing)) {
      await ctx.reply(welcomeBackMessage(existing), mainMenuReply());
      return;
    }

    const user = await ensureUserWithSession(telegramId);

    let activeUser = user;
    if (
      !isProfileComplete(activeUser) &&
      activeUser.onboardingSession?.state === 'ONBOARDING_COMPLETED'
    ) {
      await prisma.onboardingSession.update({
        where: { userId: activeUser.id },
        data: { state: 'AWAITING_FOLLOWUP_ANSWERS' },
      });
      activeUser = await reloadUser(telegramId);
      logger.info('onboarding_state_transition', {
        userId: activeUser.id,
        from: 'ONBOARDING_COMPLETED',
        to: 'AWAITING_FOLLOWUP_ANSWERS',
        reason: 'profile_incomplete_recovery',
      });
    }

    if (isProfileComplete(activeUser) && activeUser.onboardingSession?.state === 'ONBOARDING_COMPLETED') {
      await ctx.reply(welcomeBackMessage(activeUser), mainMenuReply());
      return;
    }

    if (existing !== null) {
      await ctx.reply(buildResumeMessage(activeUser));
      return;
    }

    await ctx.reply(ONBOARDING_INTRO_RU);
  },

  async tryConsumeOnboardingReply(ctx: Context): Promise<boolean> {
    if (ctx.from === undefined) {
      return false;
    }

    const telegramId = BigInt(ctx.from.id);
    const user = await findUserByTelegramId(telegramId);
    if (user === null) {
      await ctx.reply('Сначала нажми /start, чтобы мы познакомились.');
      return true;
    }

    if (isFullyOnboarded(user)) {
      return false;
    }

    const session = user.onboardingSession;
    if (session === null) {
      return false;
    }

    if (!shouldAcceptOnboardingMessage(session.state, isProfileComplete(user))) {
      return false;
    }

    let inbound: string;
    try {
      inbound = await resolveInboundText(ctx);
    } catch (err) {
      logger.error('Failed to resolve onboarding message', err);
      await ctx.reply(replyForInboundResolveError(err));
      return true;
    }

    if (inbound === '') {
      await ctx.reply('Сообщение пустое. Напиши текстом или пришли голосовое.');
      return true;
    }

    let extraction;
    try {
      extraction = await extractOnboardingProfile({ user, userMessage: inbound });
    } catch (err) {
      logger.error('Onboarding extraction failed', err);
      if (err instanceof Error && /insufficient_quota|billing/i.test(err.message)) {
        await ctx.reply(
          'У аккаунта OpenAI не хватает квоты для анализа текста. Проверь billing на platform.openai.com. Можно ответить текстом позже.',
        );
        return true;
      }
      await ctx.reply('Сейчас не получилось разобрать ответ. Попробуй короче или другими словами.');
      return true;
    }

    if (extraction.onboarding_complete && !isProfileComplete(user)) {
      logger.info('onboarding_ai_complete_mismatch', {
        userId: user.id,
        note: 'model marked complete but server profile still incomplete',
      });
    }

    const normalized = normalizeOnboardingExtraction({
      extraction,
      userMessage: inbound,
      existingTrackingKeys: jsonStringArray(user.trackingParameters),
      existingDiaryGoals: user.diaryGoals,
    });
    await applyUserProfilePatch(user.id, normalized.profilePatch);
    const fresh = await reloadUser(telegramId);

    const requiredMissing = getRequiredMissingFields(fresh);
    const serverComplete = requiredMissing.length === 0;

    if (serverComplete) {
      const finalUser = await reloadUser(telegramId);

      const fromState = session.state;
      await prisma.onboardingSession.update({
        where: { userId: finalUser.id },
        data: { state: transitionOnboardingComplete(), lastFollowUp: null },
      });
      logger.info('onboarding_state_transition', {
        userId: finalUser.id,
        from: fromState,
        to: 'ONBOARDING_COMPLETED',
        reason: 'profile_complete',
      });

      const trackingLabels = formatTrackingKeysForDisplay(
        jsonStringArray(finalUser.trackingParameters),
      );
      await ctx.reply(buildOnboardingDoneMessage(trackingLabels), mainMenuReply());
      return true;
    }

    const fromState = session.state;
    const nextState =
      fromState === 'AWAITING_INITIAL_INTRO' ? transitionAfterFirstReply() : fromState;

    const followText = buildFollowUpBlock(extraction.follow_up_questions, requiredMissing);

    await prisma.onboardingSession.update({
      where: { userId: fresh.id },
      data: { state: nextState, lastFollowUp: followText },
    });

    if (nextState !== fromState) {
      logger.info('onboarding_state_transition', {
        userId: fresh.id,
        from: fromState,
        to: nextState,
        reason: 'first_onboarding_reply',
      });
    }

    await ctx.reply(followText);
    return true;
  },
};
