/**
 * Quick check: can this machine reach OpenAI with the same settings as the bot?
 * Run: npm run check-openai
 */
import { setDefaultResultOrder } from 'node:dns';

import 'dotenv/config';

import { PermissionDeniedError } from 'openai';

import { getOpenAIClient } from '../src/ai/openai.client.js';

setDefaultResultOrder('ipv4first');

async function main(): Promise<void> {
  const openai = getOpenAIClient();
  const list = await openai.models.list();
  const first = list.data[0]?.id ?? '(empty)';
  console.log(`OK: OpenAI API reachable (example model id: ${first})`);
}

main().catch((err: unknown) => {
  console.error('FAIL: проверка OpenAI не прошла.\n');
  if (
    err instanceof PermissionDeniedError &&
    err.code === 'unsupported_country_region_territory'
  ) {
    console.error(
      'Причина: запрос доходит до OpenAI, но сервис отвечает «страна не поддерживается».\n' +
        'Так бывает, если выходной IP VPN — например, в России (в логе часто встречается код узла DME и т.п.).\n\n' +
        'Что сделать в Amnezia:\n' +
        '  1) Открой список серверов и подключись к локации, где OpenAI разрешён: США, Германия, Нидерланды, Япония и т.п.\n' +
        '  2) Если сервер только «российский» — для API OpenAI он не подойдёт; нужен зарубежный выход (свой VPS за границей или другой контур).\n' +
        '  3) Снова запусти: npm run check-openai\n',
    );
  }
  console.error(err);
  process.exit(1);
});
