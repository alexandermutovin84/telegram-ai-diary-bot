import type { Telegraf } from 'telegraf';

import { registerDiaryCommands } from './diary-commands.controller.js';
import { registerOnboardingReplies } from './onboarding-message.controller.js';
import { registerStartCommand } from './start.controller.js';

export function registerBotControllers(bot: Telegraf): void {
  registerStartCommand(bot);
  registerDiaryCommands(bot);
  registerOnboardingReplies(bot);
}
