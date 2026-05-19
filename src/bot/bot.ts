import { Telegraf } from 'telegraf';

import { registerBotControllers } from '../controllers/index.js';
import { registerBotErrorHandling } from './middleware/error.middleware.js';

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);
  registerBotErrorHandling(bot);
  registerBotControllers(bot);
  return bot;
}
