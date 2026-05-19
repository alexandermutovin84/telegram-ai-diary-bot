import type { User } from '@prisma/client';

import { getOpenAIClient } from './openai.client.js';
import { parseJsonFromModelOutput } from './onboarding/onboarding-json.parser.js';
import { validateDiaryAiResponse } from './diary/diary-response.validator.js';
import { DIARY_EXTRACTION_SYSTEM_PROMPT } from '../prompts/diary-extraction.system.js';
import type { DiaryAiResponse, DiaryStructuredData } from '../types/diary-ai.types.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { jsonStringArray } from '../utils/onboarding-profile-payload.js';
import { formatTrackingKeysForDisplay } from '../utils/tracking-parameters.js';

const MAX_ATTEMPTS = 3;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function extractDiaryEntry(params: {
  readonly user: User;
  readonly entryDate: Date;
  readonly combinedText: string;
  readonly previousStructured: DiaryStructuredData;
  readonly mode: 'initial' | 'follow_up';
}): Promise<DiaryAiResponse> {
  const client = getOpenAIClient();
  const tracking = formatTrackingKeysForDisplay(jsonStringArray(params.user.trackingParameters));
  const habits = jsonStringArray(params.user.badHabits);

  const basePayload = {
    user_tracking_parameters: tracking,
    user_bad_habits: habits,
    entry_date: isoDate(params.entryDate),
    combined_diary_text: params.combinedText,
    previous_structured_data: params.previousStructured,
    mode: params.mode,
  };

  let previousRaw = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const payload =
      attempt === 1
        ? basePayload
        : {
            ...basePayload,
            invalid_model_json_previous: previousRaw.slice(0, 4000),
          };

    const completion = await client.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DIARY_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });

    const choice = completion.choices[0];
    const raw = choice === undefined ? '' : choice.message.content;
    if (raw === null || raw === '') {
      logger.error('diary_ai_empty_response', new Error('empty content'), { attempt });
      throw new Error('OpenAI returned empty diary extraction content');
    }

    logger.info('diary_ai_raw_response', {
      attempt,
      length: raw.length,
      preview: raw.slice(0, 1200),
    });

    previousRaw = raw;
    const parsedResult = parseJsonFromModelOutput(raw);
    const parsedObj = parsedResult.ok ? parsedResult.value : null;
    const validated = parsedObj === null ? null : validateDiaryAiResponse(parsedObj);

    if (validated !== null) {
      logger.info('diary_ai_parsed', {
        attempt,
        missing_fields: [...validated.missing_fields],
        follow_up_count: validated.follow_up_questions.length,
        entry_complete: validated.entry_complete,
      });
      return validated;
    }

    logger.info('diary_ai_parse_failed', {
      attempt,
      preview: raw.slice(0, 400),
    });
  }

  throw new Error('Invalid diary extraction JSON from model after retries');
}
