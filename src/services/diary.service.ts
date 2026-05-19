import type { DiaryEntry, DiarySession } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { Context } from 'telegraf';

import { extractDiaryEntry } from '../ai/diary-extraction.service.js';
import { DIARY_PROMPT_RU } from '../bot/main-menu.keyboard.js';
import { prisma } from '../database/prisma.js';
import { EMPTY_DIARY_STRUCTURED, type DiaryAiResponse } from '../types/diary-ai.types.js';
import {
  formatDiaryCompletionMessage,
  mergeDiaryStructured,
  structuredDataFromJson,
} from '../utils/diary-completion.js';
import { jsonStringArray } from '../utils/onboarding-profile-payload.js';
import {
  decideDiaryFollowUp,
  missingParamsToJson,
  type DiaryFollowUpAction,
} from './diary-followup.service.js';
import { logger } from '../utils/logger.js';
import type { MessageIntent } from '../types/message-intent.types.js';
import {
  formatFriendlyProfileSummary,
  formatTrackingParametersList,
} from '../utils/user-profile-format.js';
import { messageIntentService } from './message-intent.service.js';
import { isProfileComplete } from '../utils/profile.js';
import { replyForInboundResolveError, resolveInboundText } from './inbound-text.service.js';
import { findUserByTelegramId, type UserWithSession } from './user.service.js';

const ANALYTICS_STUB_RU = 'аналитика пока в разработке';
const HELP_REPLY_RU =
  'помощь:\n\n' +
  '— «записать дневник» или расскажи, как прошёл день\n' +
  '— «профиль» — что я знаю о тебе\n' +
  '— «параметры» — что отслеживаем\n' +
  '— «аналитика» — скоро\n\n' +
  'можно писать текстом или голосом.';
const GENERAL_QUESTION_REPLY_RU = 'пока я умею вести дневник и помнить контекст о тебе';
const UNKNOWN_INTENT_REPLY_RU =
  'не совсем понял. хочешь записать день, посмотреть профиль или параметры?';

function utcEntryDate(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isFullyOnboardedUser(user: UserWithSession): boolean {
  return user.onboardingSession?.state === 'ONBOARDING_COMPLETED' && isProfileComplete(user);
}

async function ensureDiarySessionRow(userId: string): Promise<DiarySession> {
  return prisma.diarySession.upsert({
    where: { userId },
    create: {
      userId,
      state: 'IDLE',
      followUpRound: 0,
      missingFieldsJson: [],
      followUpQuestionsJson: [],
    },
    update: {},
  });
}

async function getOrCreateTodayEntry(userId: string): Promise<DiaryEntry> {
  const entryDate = utcEntryDate();
  const existing = await prisma.diaryEntry.findUnique({
    where: { userId_entryDate: { userId, entryDate } },
  });
  if (existing !== null) {
    if (existing.status === 'COMPLETED') {
      return prisma.diaryEntry.update({
        where: { id: existing.id },
        data: { status: 'DRAFT' },
      });
    }
    return existing;
  }
  return prisma.diaryEntry.create({
    data: {
      userId,
      entryDate,
      combinedText: '',
      structuredDataJson: EMPTY_DIARY_STRUCTURED as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
    },
  });
}

async function finalizeDiary(
  ctx: Context,
  user: UserWithSession,
  entryId: string,
  action: Extract<DiaryFollowUpAction, { type: 'finalize' }>,
  fromState: string,
): Promise<void> {
  const enabledKeys = jsonStringArray(user.trackingParameters);
  const message = formatDiaryCompletionMessage({
    summary: action.summary,
    structured: action.merged,
    enabledKeys,
    missingParameters: action.missingParameters,
  });
  const short = action.summary.trim() !== '' ? action.summary.trim() : 'день записан.';

  await prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      status: 'COMPLETED',
      structuredDataJson: action.merged as unknown as Prisma.InputJsonValue,
      missingParametersJson: missingParamsToJson(action.missingParameters),
      aiSummary: short.slice(0, 4000),
    },
  });
  await prisma.diarySession.update({
    where: { userId: user.id },
    data: {
      state: 'IDLE',
      diaryEntryId: null,
      followUpRound: 0,
      missingFieldsJson: [],
      followUpQuestionsJson: [],
    },
  });
  logger.info('diary_session_state_transition', {
    userId: user.id,
    from: fromState,
    to: 'IDLE',
    reason: 'diary_completed',
  });
  logger.info('diary_entry_saved', {
    userId: user.id,
    entryId,
    status: 'COMPLETED',
    remaining_missing_parameters: action.missingParameters,
  });
  await ctx.reply(message);
}

async function applyFollowUpAction(
  ctx: Context,
  user: UserWithSession,
  entry: DiaryEntry,
  session: DiarySession,
  action: DiaryFollowUpAction,
  fromState: string,
): Promise<void> {
  if (action.type === 'finalize') {
    await finalizeDiary(ctx, user, entry.id, action, fromState);
    return;
  }

  await prisma.diaryEntry.update({
    where: { id: entry.id },
    data: { missingParametersJson: missingParamsToJson(action.missingParameters) },
  });

  if (action.type === 'conversational') {
    await prisma.diarySession.update({
      where: { userId: user.id },
      data: {
        state: 'AWAITING_DIARY_FOLLOWUP',
        followUpRound: action.followUpRound,
        diaryEntryId: entry.id,
      },
    });
    logger.info('diary_session_state_transition', {
      userId: user.id,
      from: fromState,
      to: 'AWAITING_DIARY_FOLLOWUP',
      reason: 'conversational_follow_up',
      round: action.followUpRound,
    });
    await ctx.reply(action.message);
    return;
  }

  await prisma.diarySession.update({
    where: { userId: user.id },
    data: {
      state: 'AWAITING_DIARY_BLITZ',
      diaryEntryId: entry.id,
    },
  });
  logger.info('diary_session_state_transition', {
    userId: user.id,
    from: fromState,
    to: 'AWAITING_DIARY_BLITZ',
    reason: 'blitz_mode',
  });
  await ctx.reply(action.message);
}

async function processDiaryTurn(
  ctx: Context,
  user: UserWithSession,
  entry: DiaryEntry,
  session: DiarySession,
  combinedText: string,
  inbound: string,
  mode: 'initial' | 'follow_up',
  fromState: string,
): Promise<void> {
  let extraction;
  try {
    extraction = await runExtractionAndPersist(user, entry, combinedText, mode);
  } catch (err) {
    logger.error('diary_extraction_failed', err);
    await ctx.reply(
      mode === 'initial'
        ? 'Не получилось разобрать запись дня. Попробуй ещё раз короче.'
        : 'Не получилось обновить запись. Попробуй ещё раз.',
    );
    return;
  }

  const freshEntry = await prisma.diaryEntry.findUniqueOrThrow({ where: { id: entry.id } });
  const merged = structuredDataFromJson(freshEntry.structuredDataJson);
  const enabledKeys = jsonStringArray(user.trackingParameters);

  const action = await decideDiaryFollowUp({
    user,
    entry: freshEntry,
    session,
    merged,
    extraction,
    combinedText,
    inbound,
    enabledKeys,
  });

  await applyFollowUpAction(ctx, user, freshEntry, session, action, fromState);
}

async function processBlitzTurn(
  ctx: Context,
  user: UserWithSession,
  entry: DiaryEntry,
  session: DiarySession,
  inbound: string,
  fromState: string,
): Promise<void> {
  const merged = structuredDataFromJson(entry.structuredDataJson);
  const enabledKeys = jsonStringArray(user.trackingParameters);
  const stubExtraction = {
    structured_data: merged,
    missing_fields: [],
    follow_up_questions: [],
    short_summary: entry.aiSummary ?? '',
    entry_complete: false,
  };

  const action = await decideDiaryFollowUp({
    user,
    entry,
    session,
    merged,
    extraction: stubExtraction,
    combinedText: entry.combinedText,
    inbound,
    enabledKeys,
  });

  const freshEntry = await prisma.diaryEntry.findUniqueOrThrow({ where: { id: entry.id } });
  await applyFollowUpAction(ctx, user, freshEntry, session, action, fromState);
}

async function routeByMessageIntent(
  ctx: Context,
  user: UserWithSession,
  intent: MessageIntent,
): Promise<'handled' | 'diary_start' | 'diary_entry'> {
  switch (intent) {
    case 'profile_request':
      await ctx.reply(formatFriendlyProfileSummary(user));
      return 'handled';
    case 'analytics_request':
      await ctx.reply(ANALYTICS_STUB_RU);
      return 'handled';
    case 'parameters_request':
      await ctx.reply(formatTrackingParametersList(user));
      return 'handled';
    case 'help':
      await ctx.reply(HELP_REPLY_RU);
      return 'handled';
    case 'general_question':
      await ctx.reply(GENERAL_QUESTION_REPLY_RU);
      return 'handled';
    case 'unknown':
      await ctx.reply(UNKNOWN_INTENT_REPLY_RU);
      return 'handled';
    case 'diary_start':
      return 'diary_start';
    case 'diary_entry':
      return 'diary_entry';
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

async function startDiaryPromptFlow(ctx: Context, user: UserWithSession): Promise<void> {
  const entry = await getOrCreateTodayEntry(user.id);
  await ensureDiarySessionRow(user.id);
  await prisma.diarySession.update({
    where: { userId: user.id },
    data: {
      state: 'AWAITING_DIARY_ENTRY',
      diaryEntryId: entry.id,
      followUpRound: 0,
      missingFieldsJson: [],
      followUpQuestionsJson: [],
    },
  });
  logger.info('diary_session_state_transition', {
    userId: user.id,
    from: 'IDLE',
    to: 'AWAITING_DIARY_ENTRY',
    reason: 'menu_or_phrase',
  });
  await ctx.reply(DIARY_PROMPT_RU);
}

async function runExtractionAndPersist(
  user: UserWithSession,
  entry: DiaryEntry,
  combinedText: string,
  mode: 'initial' | 'follow_up',
): Promise<DiaryAiResponse> {
  const prev = structuredDataFromJson(entry.structuredDataJson);
  const extraction = await extractDiaryEntry({
    user,
    entryDate: entry.entryDate,
    combinedText,
    previousStructured: prev,
    mode,
  });
  const merged = mergeDiaryStructured(prev, extraction.structured_data);
  await prisma.diaryEntry.update({
    where: { id: entry.id },
    data: {
      combinedText,
      structuredDataJson: merged as unknown as Prisma.InputJsonValue,
    },
  });
  logger.info('diary_draft_updated', { userId: user.id, entryId: entry.id, mode });
  return extraction;
}

export const diaryFlowService = {
  async replyProfileCommand(ctx: Context, user: UserWithSession): Promise<void> {
    await ctx.reply(formatFriendlyProfileSummary(user));
  },

  async replyParametersCommand(ctx: Context, user: UserWithSession): Promise<void> {
    await ctx.reply(formatTrackingParametersList(user));
  },

  async tryHandlePostOnboardingMessage(ctx: Context): Promise<boolean> {
    if (ctx.from === undefined) {
      return false;
    }

    const telegramId = BigInt(ctx.from.id);
    const user = await findUserByTelegramId(telegramId);
    if (user === null || !isFullyOnboardedUser(user)) {
      return false;
    }

    await ensureDiarySessionRow(user.id);
    let session = await prisma.diarySession.findUniqueOrThrow({ where: { userId: user.id } });

    if (session.state === 'DIARY_COMPLETED') {
      await prisma.diarySession.update({
        where: { userId: user.id },
        data: { state: 'IDLE', diaryEntryId: null },
      });
      session = await prisma.diarySession.findUniqueOrThrow({ where: { userId: user.id } });
      logger.info('diary_session_state_transition', {
        userId: user.id,
        from: 'DIARY_COMPLETED',
        to: 'IDLE',
        reason: 'reset_after_complete',
      });
    }

    const today = utcEntryDate();
    if (session.state !== 'IDLE' && session.diaryEntryId !== null) {
      const linked = await prisma.diaryEntry.findUnique({ where: { id: session.diaryEntryId } });
      if (linked !== null) {
        const linkedDay = new Date(
          Date.UTC(
            linked.entryDate.getUTCFullYear(),
            linked.entryDate.getUTCMonth(),
            linked.entryDate.getUTCDate(),
          ),
        );
        if (linkedDay.getTime() !== today.getTime()) {
          await prisma.diarySession.update({
            where: { userId: user.id },
            data: {
              state: 'IDLE',
              diaryEntryId: null,
              followUpRound: 0,
              missingFieldsJson: [],
              followUpQuestionsJson: [],
            },
          });
          session = await prisma.diarySession.findUniqueOrThrow({ where: { userId: user.id } });
          logger.info('diary_session_state_transition', {
            userId: user.id,
            to: 'IDLE',
            reason: 'stale_entry_new_calendar_day',
          });
        }
      }
    }

    let inbound: string;
    try {
      inbound = await resolveInboundText(ctx);
    } catch (err) {
      logger.error('diary_inbound_resolve_failed', err);
      await ctx.reply(replyForInboundResolveError(err));
      return true;
    }

    if (inbound === '') {
      await ctx.reply('Сообщение пустое. Напиши текстом или пришли голосовое.');
      return true;
    }

    const { intent } = await messageIntentService.classify({
      message: inbound,
      diarySessionState: session.state,
    });

    const route = await routeByMessageIntent(ctx, user, intent);
    if (route === 'handled') {
      return true;
    }
    if (route === 'diary_start') {
      await startDiaryPromptFlow(ctx, user);
      return true;
    }

    if (session.state === 'IDLE') {
      const entry = await getOrCreateTodayEntry(user.id);
      const combined = inbound.trim();
      await prisma.diaryEntry.update({
        where: { id: entry.id },
        data: { combinedText: combined, rawText: combined },
      });
      await prisma.diarySession.update({
        where: { userId: user.id },
        data: { diaryEntryId: entry.id, state: 'AWAITING_DIARY_FOLLOWUP' },
      });
      logger.info('diary_session_state_transition', {
        userId: user.id,
        from: 'IDLE',
        to: 'AWAITING_DIARY_FOLLOWUP',
        reason: 'direct_diary_text',
      });

      await processDiaryTurn(
        ctx,
        user,
        entry,
        session,
        combined,
        inbound,
        'initial',
        'IDLE',
      );
      return true;
    }

    if (session.state === 'AWAITING_DIARY_ENTRY') {
      if (!session.diaryEntryId) {
        await ctx.reply('начнём заново: нажми «записать дневник».');
        await prisma.diarySession.update({
          where: { userId: user.id },
          data: { state: 'IDLE', diaryEntryId: null },
        });
        return true;
      }
      const entry = await prisma.diaryEntry.findUnique({ where: { id: session.diaryEntryId } });
      if (entry === null) {
        await prisma.diarySession.update({
          where: { userId: user.id },
          data: { state: 'IDLE', diaryEntryId: null },
        });
        return true;
      }
      const combined = inbound.trim();
      await prisma.diaryEntry.update({
        where: { id: entry.id },
        data: { combinedText: combined, rawText: combined },
      });
      await prisma.diarySession.update({
        where: { userId: user.id },
        data: { state: 'AWAITING_DIARY_FOLLOWUP' },
      });
      logger.info('diary_session_state_transition', {
        userId: user.id,
        from: 'AWAITING_DIARY_ENTRY',
        to: 'AWAITING_DIARY_FOLLOWUP',
        reason: 'first_entry',
      });

      const sessionAfter = await prisma.diarySession.findUniqueOrThrow({
        where: { userId: user.id },
      });
      await processDiaryTurn(
        ctx,
        user,
        entry,
        sessionAfter,
        combined,
        inbound,
        'initial',
        'AWAITING_DIARY_ENTRY',
      );
      return true;
    }

    if (session.state === 'AWAITING_DIARY_FOLLOWUP' || session.state === 'AWAITING_DIARY_BLITZ') {
      if (!session.diaryEntryId) {
        await prisma.diarySession.update({
          where: { userId: user.id },
          data: { state: 'IDLE' },
        });
        return false;
      }
      const entry = await prisma.diaryEntry.findUnique({ where: { id: session.diaryEntryId } });
      if (entry === null) {
        await prisma.diarySession.update({
          where: { userId: user.id },
          data: { state: 'IDLE', diaryEntryId: null },
        });
        return true;
      }

      if (session.state === 'AWAITING_DIARY_BLITZ') {
        await processBlitzTurn(ctx, user, entry, session, inbound, session.state);
        return true;
      }

      const combined = `${entry.combinedText.trim()}\n\n${inbound.trim()}`.trim();
      await prisma.diaryEntry.update({
        where: { id: entry.id },
        data: { combinedText: combined },
      });
      await processDiaryTurn(
        ctx,
        user,
        entry,
        session,
        combined,
        inbound,
        'follow_up',
        session.state,
      );
      return true;
    }

    return false;
  },
};
