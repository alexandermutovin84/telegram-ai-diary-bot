import type { Telegraf } from 'telegraf';

import { onboardingFlowService } from '../services/onboarding.service.js';

export function registerStartCommand(bot: Telegraf): void {
  bot.start(async (ctx) => {
    await onboardingFlowService.handleStart(ctx);
  });
}
