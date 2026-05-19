import { getOpenAIClient } from './openai.client.js';
import { parseJsonFromModelOutput } from './onboarding/onboarding-json.parser.js';
import { MESSAGE_INTENT_SYSTEM_PROMPT } from '../prompts/message-intent.system.js';
import {
  MESSAGE_INTENTS,
  type MessageIntent,
  type MessageIntentClassification,
} from '../types/message-intent.types.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

function isMessageIntent(value: unknown): value is MessageIntent {
  return typeof value === 'string' && (MESSAGE_INTENTS as readonly string[]).includes(value);
}

function validateClassification(obj: unknown): MessageIntentClassification | null {
  if (obj === null || typeof obj !== 'object') {
    return null;
  }
  const rec = obj as Record<string, unknown>;
  const intent = rec['intent'];
  const confidence = rec['confidence'];
  if (!isMessageIntent(intent)) {
    return null;
  }
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return null;
  }
  const c = Math.min(1, Math.max(0, confidence));
  return { intent, confidence: c };
}

export async function classifyMessageIntentWithAi(
  message: string,
): Promise<MessageIntentClassification | null> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: MESSAGE_INTENT_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ message }) },
    ],
  });

  const raw = completion.choices[0]?.message.content;
  if (raw === null || raw === undefined || raw === '') {
    logger.info('message_intent_ai_empty_response');
    return null;
  }

  const parsed = parseJsonFromModelOutput(raw);
  if (!parsed.ok) {
    logger.info('message_intent_ai_parse_failed', { preview: raw.slice(0, 200) });
    return null;
  }

  return validateClassification(parsed.value);
}
