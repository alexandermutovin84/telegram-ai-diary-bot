import type { Context } from 'telegraf';
import type { Telegraf } from 'telegraf';

import { mainMenuReply } from '../bot/main-menu.keyboard.js';
import { diaryFlowService, isFullyOnboardedUser } from '../services/diary.service.js';
import { findUserByTelegramId, type UserWithSession } from '../services/user.service.js';

async function requireOnboardedUser(ctx: Context): Promise<UserWithSession | null> {
  if (ctx.from === undefined) {
    await ctx.reply('Не удалось определить пользователя Telegram.');
    return null;
  }
  const user = await findUserByTelegramId(BigInt(ctx.from.id));
  if (user === null) {
    await ctx.reply('Сначала нажми /start.');
    return null;
  }
  if (!isFullyOnboardedUser(user)) {
    await ctx.reply('Сначала заверши короткое знакомство через /start.');
    return null;
  }
  return user;
}

export function registerDiaryCommands(bot: Telegraf): void {
  bot.command('profile', async (ctx) => {
    const user = await requireOnboardedUser(ctx);
    if (user === null) {
      return;
    }
    await diaryFlowService.replyProfileCommand(ctx, user);
  });

  bot.command('parameters', async (ctx) => {
    const user = await requireOnboardedUser(ctx);
    if (user === null) {
      return;
    }
    await diaryFlowService.replyParametersCommand(ctx, user);
  });

  bot.command('menu', async (ctx) => {
    const user = await requireOnboardedUser(ctx);
    if (user === null) {
      return;
    }
    await ctx.reply('главное меню:', mainMenuReply());
  });
}
