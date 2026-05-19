import type { Context } from 'telegraf';
import {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';

import { downloadTelegramFileBuffer } from './telegram-file.service.js';
import { transcribeAudioBuffer } from './transcription.service.js';

export function replyForInboundResolveError(err: unknown): string {
  if (err instanceof APIConnectionError) {
    return (
      'Сеть оборвала соединение с OpenAI (Whisper). Проверь VPN, попробуй голос ещё раз короче. ' +
      'Диагностика: npm run check-openai и npm run check-whisper в папке проекта. Можно ответить текстом.'
    );
  }
  if (err instanceof Error && /insufficient_quota|exceeded your current quota|billing details/i.test(err.message)) {
    return 'У аккаунта OpenAI нет квоты или не настроена оплата — Whisper недоступен. Проверь раздел Billing на platform.openai.com. Пока ответь текстом.';
  }
  if (err instanceof AuthenticationError) {
    return 'Ключ OpenAI недействителен. Проверь OPENAI_API_KEY в .env.';
  }
  if (err instanceof PermissionDeniedError) {
    if (err.code === 'unsupported_country_region_territory') {
      return (
        'OpenAI видит запрос из страны, где API недоступен (часто из-за выходной ноды VPN). ' +
        'Смени сервер/страну в Amnezia или импортируй список IP из data/amnezia-openai-chatgpt.ip-list.json (инструкция: data/AMNEZIA-IMPORT.txt). Можно ответить текстом.'
      );
    }
    return 'OpenAI отклонил запрос (нет доступа или ограничение региона). Проверь VPN/настройки ключа и попробуй снова.';
  }
  if (err instanceof RateLimitError) {
    return 'Лимит запросов к OpenAI. Подожди минуту и попробуй снова.';
  }
  if (err instanceof BadRequestError) {
    return 'Голосовое не подошло для распознавания. Попробуй короче или отправь текстом.';
  }
  if (err instanceof TypeError) {
    return 'Сетевая ошибка при обработке голосового. Проверь соединение или VPN и попробуй снова.';
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Скачивание голосового из Telegram слишком долгое. Попробуй короче или текстом.';
    }
    if (err.message.includes('Telegram file download')) {
      return 'Не удалось скачать голосовое из Telegram. Отправь запись ещё раз или текстом.';
    }
    if (err.message.includes('path missing') || err.message.includes('empty body')) {
      return 'Файл голосового недоступен или пустой. Запиши ещё раз или отправь текстом.';
    }
    if (err.message === 'Empty transcription') {
      return 'В записи не распознана речь. Говори громче или ближе к микрофону, либо напиши текстом.';
    }
  }
  return 'Не получилось обработать сообщение. Попробуй ещё раз текстом или коротким голосовым.';
}

export async function resolveInboundText(ctx: Context): Promise<string> {
  const msg = ctx.message;
  if (msg === undefined) {
    throw new Error('Missing message');
  }
  if ('text' in msg) {
    return msg.text.trim();
  }
  if ('voice' in msg) {
    const { buffer, filename } = await downloadTelegramFileBuffer(ctx.telegram, msg.voice.file_id);
    const text = await transcribeAudioBuffer({ buffer, filename });
    if (text === '') {
      throw new Error('Empty transcription');
    }
    return text;
  }
  throw new Error('Unsupported message type');
}
