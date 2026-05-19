import { Markup } from 'telegraf';

export const MENU_RECORD_DIARY = 'записать дневник';
export const MENU_ANALYTICS = 'аналитика';
export const MENU_PROFILE = 'профиль';
export const MENU_PARAMETERS = 'параметры';

export const DIARY_PROMPT_RU = 'как прошёл день? можешь ответить голосом или текстом.';

export function mainMenuReply(): ReturnType<typeof Markup.keyboard> {
  return Markup.keyboard([
    [MENU_RECORD_DIARY, MENU_ANALYTICS],
    [MENU_PROFILE, MENU_PARAMETERS],
  ])
    .resize()
    .persistent();
}
