import type { Telegraf } from 'telegraf';
import { anyOf, message } from 'telegraf/filters';

import { diaryFlowService, isFullyOnboardedUser } from '../services/diary.service.js';
import { onboardingFlowService } from '../services/onboarding.service.js';
import { findUserByTelegramId } from '../services/user.service.js';

export function registerOnboardingReplies(bot: Telegraf): void {
  bot.on(
    anyOf(message('text'), message('voice')),
    async (ctx, next) => {
      if ('text' in ctx.message && ctx.message.text.startsWith('/')) {
        await next();
        return;
      }

      const handledOnboarding = await onboardingFlowService.tryConsumeOnboardingReply(ctx);
      if (handledOnboarding) {
        return;
      }

      const user = await findUserByTelegramId(BigInt(ctx.from.id));
      if (user !== null && isFullyOnboardedUser(user)) {
        const handledDiary = await diaryFlowService.tryHandlePostOnboardingMessage(ctx);
        if (handledDiary) {
          return;
        }
        await ctx.reply('не получилось обработать. попробуй «записать дневник» или напиши, как прошёл день.');
        return;
      }

      await next();
    },
  );
}
