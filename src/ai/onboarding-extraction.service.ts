import type { User } from '@prisma/client';

import { getOpenAIClient } from './openai.client.js';
import { parseJsonFromModelOutput } from './onboarding/onboarding-json.parser.js';
import { validateOnboardingAiResponse } from './onboarding/onboarding-response.validator.js';
import { ONBOARDING_EXTRACTION_SYSTEM_PROMPT } from '../prompts/onboarding-extraction.system.js';
import type { OnboardingAiResponse } from '../types/onboarding-ai.types.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { userToAiCurrentProfilePayload } from '../utils/onboarding-profile-payload.js';

const MAX_ATTEMPTS = 3;

export async function extractOnboardingProfile(params: {
  readonly user: User;
  readonly userMessage: string;
}): Promise<OnboardingAiResponse> {
  const client = getOpenAIClient();
  const basePayload = {
    current_profile: userToAiCurrentProfilePayload(params.user),
    user_message: params.userMessage,
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
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ONBOARDING_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });

    const choice = completion.choices[0];
    const raw = choice === undefined ? '' : choice.message.content;
    if (raw === null || raw === '') {
      logger.error('onboarding_ai_empty_response', new Error('empty content'), { attempt });
      throw new Error('OpenAI returned empty extraction content');
    }

    logger.info('onboarding_ai_raw_response', {
      attempt,
      length: raw.length,
      preview: raw.slice(0, 1200),
    });

    previousRaw = raw;
    const parsedResult = parseJsonFromModelOutput(raw);
    const parsedObj = parsedResult.ok ? parsedResult.value : null;
    const validated =
      parsedObj === null ? null : validateOnboardingAiResponse(parsedObj);

    if (validated !== null) {
      logger.info('onboarding_ai_parsed', {
        attempt,
        missing_fields: [...validated.missing_fields],
        follow_up_count: validated.follow_up_questions.length,
        onboarding_complete: validated.onboarding_complete,
      });
      return validated;
    }

    logger.info('onboarding_ai_parse_failed', {
      attempt,
      preview: raw.slice(0, 400),
    });
  }

  throw new Error('Invalid extraction JSON from model after retries');
}
