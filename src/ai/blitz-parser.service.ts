import { getOpenAIClient } from './openai.client.js';
import { parseJsonFromModelOutput } from './onboarding/onboarding-json.parser.js';
import { BLITZ_PARSER_SYSTEM_PROMPT } from '../prompts/blitz-parser.system.js';
import type { BlitzAnswerValue, BlitzParseResult } from '../utils/diary-blitz.js';
import { parseBlitzByRules } from '../utils/diary-blitz.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import type { TrackingParameterKey } from '../utils/tracking-parameters.js';
import { isTrackingParameterKey } from '../utils/tracking-parameters.js';

function coerceBlitzValues(obj: unknown): Record<string, BlitzAnswerValue> {
  if (typeof obj !== 'object' || obj === null) {
    return {};
  }
  const root = obj as Record<string, unknown>;
  const valuesRaw = root['values'];
  if (typeof valuesRaw !== 'object' || valuesRaw === null) {
    return {};
  }
  const out: Record<string, BlitzAnswerValue> = {};
  for (const [k, v] of Object.entries(valuesRaw as Record<string, unknown>)) {
    if (!isTrackingParameterKey(k)) {
      continue;
    }
    if (typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
    } else if (typeof v === 'string' && v.trim() !== '') {
      out[k] = v.trim();
    }
  }
  return out;
}

export async function parseBlitzAnswers(params: {
  readonly userMessage: string;
  readonly expectedKeys: readonly TrackingParameterKey[];
}): Promise<BlitzParseResult> {
  const rules = parseBlitzByRules(params.userMessage, params.expectedKeys);
  if (Object.keys(rules.values).length >= Math.min(2, params.expectedKeys.length)) {
    logger.info('blitz_parsed', { source: 'rules', keys: Object.keys(rules.values) });
    return rules;
  }

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: BLITZ_PARSER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          user_message: params.userMessage,
          expected_parameters: params.expectedKeys,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message.content ?? '';
  const parsed = parseJsonFromModelOutput(raw);
  if (!parsed.ok) {
    logger.info('blitz_parsed', { source: 'rules_fallback', keys: Object.keys(rules.values) });
    return rules;
  }

  const values = coerceBlitzValues(parsed.value);
  const merged = { ...rules.values, ...values };
  logger.info('blitz_parsed', { source: 'ai', keys: Object.keys(merged) });
  return { values: merged };
}
