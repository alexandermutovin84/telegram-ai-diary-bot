import type { Telegraf } from 'telegraf';

import { logger } from '../../utils/logger.js';

export function registerBotErrorHandling(bot: Telegraf): void {
  bot.catch((err, ctx) => {
    logger.error('Telegraf handler error', err, { updateId: ctx.update.update_id });
    void ctx.reply('Something went wrong. Please try again later.').catch(() => {
      /* ignore secondary failures */
    });
  });
}
