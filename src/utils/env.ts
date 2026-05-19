import { config } from 'dotenv';

config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  return value;
}

/** Railway/Fly set PORT; local dev uses HEALTH_PORT. */
const healthPortRaw = process.env['PORT'] ?? process.env['HEALTH_PORT'] ?? '3000';
const healthPort = Number.parseInt(healthPortRaw, 10);
if (Number.isNaN(healthPort) || healthPort < 1 || healthPort > 65535) {
  throw new Error('HEALTH_PORT must be a valid TCP port (1–65535)');
}

export interface AppEnv {
  readonly NODE_ENV: string;
  readonly TELEGRAM_BOT_TOKEN: string;
  readonly DATABASE_URL: string;
  readonly OPENAI_API_KEY: string;
  /** HTTP(S) proxy URL for OpenAI only, e.g. http://127.0.0.1:7890 (Clash/V2Ray local port). */
  readonly OPENAI_HTTPS_PROXY: string | undefined;
  readonly OPENAI_CHAT_MODEL: string;
  readonly HEALTH_PORT: number;
}

function readOpenAiHttpsProxy(): string | undefined {
  const explicit = readOptional('OPENAI_HTTPS_PROXY');
  if (explicit !== undefined) {
    return explicit;
  }
  const httpsProxy = readOptional('HTTPS_PROXY');
  if (httpsProxy !== undefined) {
    return httpsProxy;
  }
  return readOptional('HTTP_PROXY');
}

export const env: AppEnv = {
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  TELEGRAM_BOT_TOKEN: requireEnv('TELEGRAM_BOT_TOKEN'),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
  OPENAI_HTTPS_PROXY: readOpenAiHttpsProxy(),
  OPENAI_CHAT_MODEL: readOptional('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
  HEALTH_PORT: healthPort,
};
