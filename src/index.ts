import { createBot } from './bot/bot.js';
import { prisma } from './database/prisma.js';
import { env } from './utils/env.js';
import { startHealthServer } from './utils/health-server.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connection established');

  const health = await startHealthServer(env.HEALTH_PORT);
  logger.info('Health server listening', { port: health.port });

  if (env.OPENAI_HTTPS_PROXY === undefined) {
    logger.info(
      'OpenAI: HTTP-прокси в .env не задан — клиент идёт напрямую (как браузер). Для split tunnel см. data/AMNEZIA-IMPORT.txt.',
    );
  }

  const bot = createBot(env.TELEGRAM_BOT_TOKEN);
  // `bot.launch()` resolves only when polling stops; log from the onLaunch hook instead.
  void bot
    .launch({}, () => {
      logger.info('Telegram bot launched (long polling)');
    })
    .catch((err: unknown) => {
      logger.error('Telegram bot launch failed', err);
      process.exit(1);
    });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Shutting down', { signal });
    bot.stop(signal);
    await health.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('Bootstrap failed', err);
  process.exit(1);
});
