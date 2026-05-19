import type { DiaryEntry, DiarySession } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { parseBlitzAnswers } from '../ai/blitz-parser.service.js';
import type { DiaryAiResponse, DiaryStructuredData } from '../types/diary-ai.types.js';
import {
  buildBlitzBlock,
  blitzKeysForLog,
  mergeBlitzIntoStructured,
} from '../utils/diary-blitz.js';
import {
  conversationalDiaryFollowUps,
  getCoreDiaryGaps,
  isDiaryCoreComplete,
  userDeclaresNoMoreDiary,
  userSkipsBlitz,
} from '../utils/diary-completion.js';
import {
  blitzEligibleMissing,
  getMissingEnabledTrackingParams,
  tier1Missing,
} from '../utils/diary-tracking-fields.js';
import { logger } from '../utils/logger.js';
import type { TrackingParameterKey } from '../utils/tracking-parameters.js';
import type { UserWithSession } from './user.service.js';

const MAX_CONVERSATIONAL_ROUNDS = 2;
const MAX_CONVERSATIONAL_QUESTIONS = 3;

export type DiaryFollowUpAction =
  | {
      readonly type: 'conversational';
      readonly message: string;
      readonly followUpRound: number;
      readonly missingParameters: readonly TrackingParameterKey[];
    }
  | {
      readonly type: 'blitz';
      readonly message: string;
      readonly missingParameters: readonly TrackingParameterKey[];
    }
  | {
      readonly type: 'finalize';
      readonly merged: DiaryStructuredData;
      readonly summary: string;
      readonly missingParameters: readonly TrackingParameterKey[];
    };

function persistMissingParams(missing: readonly TrackingParameterKey[]): string[] {
  return [...missing];
}

function buildConversationalBlock(
  extraction: DiaryAiResponse,
  tier1Gaps: ReturnType<typeof getCoreDiaryGaps>,
): string {
  const fromAi = extraction.follow_up_questions
    .map((q) => q.trim())
    .filter((q) => q !== '')
    .slice(0, MAX_CONVERSATIONAL_QUESTIONS);
  if (fromAi.length > 0) {
    return fromAi.join('\n\n');
  }
  return conversationalDiaryFollowUps(tier1Gaps, MAX_CONVERSATIONAL_QUESTIONS).join('\n\n');
}

export async function decideDiaryFollowUp(params: {
  readonly user: UserWithSession;
  readonly entry: DiaryEntry;
  readonly session: DiarySession;
  readonly merged: DiaryStructuredData;
  readonly extraction: DiaryAiResponse;
  readonly combinedText: string;
  readonly inbound: string;
  readonly enabledKeys: readonly string[];
}): Promise<DiaryFollowUpAction> {
  const { merged, extraction, combinedText, inbound, session, enabledKeys } = params;
  const combinedLen = combinedText.length;
  const stop = userDeclaresNoMoreDiary(inbound);

  const missing = getMissingEnabledTrackingParams(merged, enabledKeys);
  const missingStorage = persistMissingParams(missing);

  logger.info('remaining_missing_parameters', {
    userId: params.user.id,
    entryId: params.entry.id,
    missing: missingStorage,
  });

  if (session.state === 'AWAITING_DIARY_BLITZ') {
    if (userSkipsBlitz(inbound)) {
      logger.info('blitz_skipped', { userId: params.user.id, remaining: missingStorage });
      return {
        type: 'finalize',
        merged,
        summary: extraction.short_summary,
        missingParameters: missing,
      };
    }
    const blitzKeys = blitzEligibleMissing(missing);
    const parsed = await parseBlitzAnswers({
      userMessage: inbound,
      expectedKeys: blitzKeys.length > 0 ? blitzKeys : missing,
    });
    const afterBlitz = mergeBlitzIntoStructured(merged, parsed.values);
    const stillMissing = getMissingEnabledTrackingParams(afterBlitz, enabledKeys);
    return {
      type: 'finalize',
      merged: afterBlitz,
      summary: extraction.short_summary,
      missingParameters: stillMissing,
    };
  }

  const tier1 = tier1Missing(missing);
  const coreOk = isDiaryCoreComplete(merged, combinedLen);
  const conversationalRound = session.followUpRound;

  if (stop) {
    const blitzKeys = blitzEligibleMissing(missing);
    if (blitzKeys.length > 0) {
      const block = buildBlitzBlock(blitzKeys);
      logger.info('blitz_started', {
        userId: params.user.id,
        blitz_questions: blitzKeysForLog(blitzKeys),
        reason: 'user_stop_with_gaps',
      });
      return { type: 'blitz', message: block, missingParameters: missing };
    }
    return {
      type: 'finalize',
      merged,
      summary: extraction.short_summary,
      missingParameters: missing,
    };
  }

  if (
    conversationalRound < MAX_CONVERSATIONAL_ROUNDS &&
    tier1.length > 0 &&
    !extraction.entry_complete
  ) {
    const tier1Gaps = getCoreDiaryGaps(merged, combinedLen);
    const message = buildConversationalBlock(extraction, tier1Gaps);
    return {
      type: 'conversational',
      message,
      followUpRound: conversationalRound + 1,
      missingParameters: missing,
    };
  }

  const blitzKeys = blitzEligibleMissing(missing);
  if (blitzKeys.length > 0 && (coreOk || conversationalRound >= 1 || extraction.entry_complete)) {
    const block = buildBlitzBlock(blitzKeys);
    logger.info('blitz_started', {
      userId: params.user.id,
      blitz_questions: blitzKeysForLog(blitzKeys),
      reason: 'after_conversational',
    });
    return { type: 'blitz', message: block, missingParameters: missing };
  }

  if (coreOk || extraction.entry_complete || conversationalRound >= MAX_CONVERSATIONAL_ROUNDS) {
    return {
      type: 'finalize',
      merged,
      summary: extraction.short_summary,
      missingParameters: missing,
    };
  }

  const tier1Gaps = getCoreDiaryGaps(merged, combinedLen);
  return {
    type: 'conversational',
    message: buildConversationalBlock(extraction, tier1Gaps),
    followUpRound: conversationalRound + 1,
    missingParameters: missing,
  };
}

export function missingParamsToJson(missing: readonly TrackingParameterKey[]): Prisma.InputJsonValue {
  return persistMissingParams(missing);
}

