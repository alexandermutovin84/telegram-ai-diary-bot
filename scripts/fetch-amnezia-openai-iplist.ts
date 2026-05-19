/**
 * Downloads IPv4 CIDR list for OpenAI-related traffic (iplist portal "chatgpt.com")
 * in Amnezia import format. Source: https://iplist.opencck.org/ (not affiliated with this repo).
 *
 * Run: npm run amnezia:iplist
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://iplist.opencck.org/?format=amnezia&data=cidr4&site=chatgpt.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'amnezia-openai-chatgpt.ip-list.json');

async function main(): Promise<void> {
  const res = await fetch(SOURCE);
  if (!res.ok) {
    throw new Error(`iplist HTTP ${String(res.status)}`);
  }
  const text = await res.text();
  if (text.trim() === '' || text.trim() === '[]') {
    throw new Error('iplist returned empty body');
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${text.trim()}\n`, 'utf8');
  console.log(`Wrote ${OUT} (${String(text.length)} bytes)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
