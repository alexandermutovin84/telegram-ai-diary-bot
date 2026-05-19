import {
  MENU_ANALYTICS,
  MENU_PARAMETERS,
  MENU_PROFILE,
  MENU_RECORD_DIARY,
} from '../bot/main-menu.keyboard.js';
import type { MessageIntent, MessageIntentClassification } from '../types/message-intent.types.js';

const PROFILE_PATTERNS: readonly RegExp[] = [
  /что ты знаешь/i,
  /знаешь обо мне/i,
  /что ты о мне/i,
  /что помнишь про меня/i,
  /что сохранено обо мне/i,
  /мой профиль/i,
  /расскажи.*профил/i,
  /про меня расскажи/i,
  /кто я\b/i,
  /как меня зовут/i,
  /что ты про меня/i,
  /покажи профиль/i,
];

const DIARY_START_PATTERNS: readonly RegExp[] = [
  /^записать дневник$/i,
  /^записать день$/i,
  /хочу записать день/i,
  /хочу записать дневник/i,
  /начать дневник/i,
  /начну дневник/i,
  /хочу дневник/i,
  /запишем день/i,
  /давай дневник/i,
];

const ANALYTICS_PATTERNS: readonly RegExp[] = [
  /^аналитика$/i,
  /покажи аналитик/i,
  /моя аналитик/i,
  /статистик/i,
  /отчёт по дневник/i,
  /отчет по дневник/i,
];

const PARAMETERS_PATTERNS: readonly RegExp[] = [
  /^параметры$/i,
  /какие параметры/i,
  /что отслежива/i,
  /что ты отслежива/i,
  /список параметров/i,
  /параметры отслеживания/i,
];

const HELP_PATTERNS: readonly RegExp[] = [
  /^помощь$/i,
  /^help$/i,
  /как пользоваться/i,
  /что ты умеешь/i,
  /какие команды/i,
  /инструкция/i,
];

const GENERAL_QUESTION_PATTERNS: readonly RegExp[] = [
  /^(кто ты|что ты|ты кто)\??$/i,
  /зачем (ты|мне) дневник/i,
  /что такое дневник/i,
  /как работает бот/i,
];

const DIARY_NARRATIVE_PATTERNS: readonly RegExp[] = [
  /сегодня\b/i,
  /вчера\b/i,
  /был тяжел/i,
  /был тяжёлый/i,
  /прошёл день/i,
  /прошел день/i,
  /не спал/i,
  /плохо спал/i,
  /устал/i,
  /устала/i,
  /настроени/i,
  /пережил/i,
  /пережила/i,
  /весь день/i,
  /на работе/i,
  /после работы/i,
  /с утра/i,
  /вечером\b/i,
];

function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (t.endsWith('?')) {
    return true;
  }
  return /^(что|как|кто|где|когда|зачем|почему|можно ли|расскажи|покажи)\b/i.test(t);
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function result(intent: MessageIntent, confidence: number): MessageIntentClassification {
  return { intent, confidence };
}

/**
 * Fast rule-based intent classification (no network).
 */
export function classifyMessageIntentByRules(
  raw: string,
  options?: { readonly inActiveDiarySession?: boolean },
): MessageIntentClassification {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const inDiary = options?.inActiveDiarySession === true;

  if (text === MENU_RECORD_DIARY) {
    return result('diary_start', 1);
  }
  if (text === MENU_ANALYTICS) {
    return result('analytics_request', 1);
  }
  if (text === MENU_PROFILE) {
    return result('profile_request', 1);
  }
  if (text === MENU_PARAMETERS) {
    return result('parameters_request', 1);
  }

  if (matchesAny(text, HELP_PATTERNS)) {
    return result('help', 0.95);
  }

  if (matchesAny(text, PROFILE_PATTERNS) || text === MENU_PROFILE) {
    return result('profile_request', 0.95);
  }

  if (matchesAny(text, ANALYTICS_PATTERNS)) {
    return result('analytics_request', 0.92);
  }

  if (matchesAny(text, PARAMETERS_PATTERNS)) {
    return result('parameters_request', 0.92);
  }

  if (matchesAny(text, DIARY_START_PATTERNS) && text.length < 100) {
    return result('diary_start', 0.93);
  }

  if (matchesAny(text, GENERAL_QUESTION_PATTERNS)) {
    return result('general_question', 0.88);
  }

  if (inDiary) {
    if (looksLikeQuestion(text) && matchesAny(text, PROFILE_PATTERNS)) {
      return result('profile_request', 0.9);
    }
    return result('diary_entry', 0.75);
  }

  if (looksLikeQuestion(text)) {
    if (matchesAny(text, PROFILE_PATTERNS)) {
      return result('profile_request', 0.95);
    }
    if (/аналитик/i.test(lower)) {
      return result('analytics_request', 0.9);
    }
    if (/параметр|отслежива/i.test(lower)) {
      return result('parameters_request', 0.88);
    }
    if (/помощь|умеешь|команды/i.test(lower)) {
      return result('help', 0.88);
    }
    return result('general_question', 0.72);
  }

  if (matchesAny(text, DIARY_NARRATIVE_PATTERNS) || (text.length >= 50 && !looksLikeQuestion(text))) {
    return result('diary_entry', 0.85);
  }

  if (text.length >= 25 && !looksLikeQuestion(text)) {
    return result('diary_entry', 0.7);
  }

  return result('unknown', 0.35);
}
