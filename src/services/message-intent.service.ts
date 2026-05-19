import type { DiarySessionState } from '@prisma/client';

import { classifyMessageIntentWithAi } from '../ai/message-intent-classification.service.js';
import type { MessageIntent, MessageIntentClassification } from '../types/message-intent.types.js';
import { classifyMessageIntentByRules } from '../utils/message-intent-rules.js';
import { logger } from '../utils/logger.js';

const RULE_CONFIDENCE_THRESHOLD = 0.75;

function isActiveDiarySession(state: DiarySessionState): boolean {
  return (
    state === 'AWAITING_DIARY_ENTRY' ||
    state === 'AWAITING_DIARY_FOLLOWUP' ||
    state === 'AWAITING_DIARY_BLITZ'
  );
}

function shouldUseAiFallback(rules: MessageIntentClassification): boolean {
  if (rules.intent === 'unknown') {
    return true;
  }
  return rules.confidence < RULE_CONFIDENCE_THRESHOLD;
}

export const messageIntentService = {
  async classify(params: {
    readonly message: string;
    readonly diarySessionState: DiarySessionState;
  }): Promise<MessageIntentClassification> {
    const trimmed = params.message.trim();
    const inActiveDiarySession = isActiveDiarySession(params.diarySessionState);

    let classification = classifyMessageIntentByRules(trimmed, { inActiveDiarySession });
    let source: 'rules' | 'ai' = 'rules';

    if (shouldUseAiFallback(classification)) {
      try {
        const ai = await classifyMessageIntentWithAi(trimmed);
        if (ai !== null) {
          classification = ai;
          source = 'ai';
        }
      } catch (err) {
        logger.error('message_intent_ai_failed', err);
      }
    }

    if (inActiveDiarySession && classification.intent === 'unknown') {
      classification = { intent: 'diary_entry', confidence: 0.65 };
      source = 'rules';
    }

    logger.info('message_intent_classified', {
      message: trimmed.slice(0, 500),
      intent: classification.intent,
      confidence: classification.confidence,
      source,
      diarySessionState: params.diarySessionState,
    });

    return classification;
  },
};

export type { MessageIntent, MessageIntentClassification };
