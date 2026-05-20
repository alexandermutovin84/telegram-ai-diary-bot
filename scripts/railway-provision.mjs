#!/usr/bin/env node
/**
 * Добавляет PostgreSQL в проект Railway и проставляет DATABASE_URL боту через reference.
 *
 * Требуется один раз: railway login (или токен в CI — см. документацию Railway).
 *
 * Переменные окружения:
 *   RAILWAY_PROJECT_ID — если папка ещё не привязана (UUID из URL проекта)
 *   BOT_SERVICE_NAME   — default: telegram-ai-diary-bot
 *   POSTGRES_SERVICE_NAME — если Postgres уже есть под другим именем
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);

const BOT_SERVICE = process.env.BOT_SERVICE_NAME ?? 'telegram-ai-diary-bot';
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID ?? '';
const FORCED_POSTGRES = process.env.POSTGRES_SERVICE_NAME ?? '';

function railwayBin() {
  const local = resolve(root, 'node_modules/.bin/railway');
  if (existsSync(local)) return local;
  return 'railway';
}

function runRailway(args, { json = false } = {}) {
  const bin = railwayBin();
  const extra = json ? ['--json'] : [];
  const fullArgs = [...args, ...extra];
  try {
    if (bin === 'railway') {
      return execFileSync('npx', ['--yes', '@railway/cli@latest', ...fullArgs], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }
    return execFileSync(bin, fullArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e;
    const stderr = err.stderr?.toString?.() ?? '';
    const stdout = err.stdout?.toString?.() ?? '';
    throw new Error((stderr || stdout || err.message).trim() || String(err));
  }
}

function runRailwayNoJson(args, { input } = {}) {
  const bin = railwayBin();
  const stdio = input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'];
  try {
    if (bin === 'railway') {
      return execFileSync('npx', ['--yes', '@railway/cli@latest', ...args], {
        encoding: 'utf8',
        stdio,
        ...(input !== undefined ? { input } : {}),
      });
    }
    return execFileSync(bin, args, {
      encoding: 'utf8',
      stdio,
      ...(input !== undefined ? { input } : {}),
    });
  } catch (e) {
    const err = e;
    throw new Error(err.stderr?.toString?.() || err.message || String(err));
  }
}

function runRailwayAddPostgres() {
  console.error('Создаю плагин Postgres (режим без TTY)…');
  runRailwayNoJson(['add', '-d', 'postgres', '--json'], { input: '\n' });
}

function ensureWhoami() {
  try {
    runRailway(['whoami'], { json: false });
  } catch {
    console.error(`Сначала войдите в Railway CLI:
  cd "${root}"
  npx @railway/cli login
`);
    process.exit(1);
  }
}

function cwdLinkedToRailway() {
  if (existsSync(resolve(root, '.railway', 'config.json'))) {
    return true;
  }
  try {
    runRailway(['service', 'list'], { json: true });
    return true;
  } catch {
    return false;
  }
}

function ensureLinked() {
  if (cwdLinkedToRailway()) return;
  if (!PROJECT_ID) {
    console.error(`Каталог не привязан к проекту Railway. Сделайте одно из двух:

  А) Интерактивно (выберите проект и сервис «${BOT_SERVICE}»):
     cd "${root}"
     npx railway link
     npm run railway:provision

  Б) По ID из URL проекта (…/project/<UUID>/…):
     export RAILWAY_PROJECT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
     npm run railway:provision
`);
    process.exit(1);
  }
  console.error(`Привязка к проекту ${PROJECT_ID}, сервис «${BOT_SERVICE}»…`);
  runRailwayNoJson(['link', '-p', PROJECT_ID, '-s', BOT_SERVICE]);
}

function parseServiceList(raw) {
  const text = raw.trim();
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.services)) return data.services;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function pickPostgresName(services) {
  if (FORCED_POSTGRES) return FORCED_POSTGRES;
  const names = services.map((s) => (typeof s === 'object' && s ? s.name : null)).filter(Boolean);
  const byExact = names.find((n) => n === 'Postgres');
  if (byExact) return byExact;
  const byWord = names.find((n) => n !== BOT_SERVICE && /postgres/i.test(String(n)));
  if (byWord) return byWord;
  const others = names.filter((n) => n !== BOT_SERVICE);
  if (others.length === 1) return others[0];
  return null;
}

function ensurePostgres() {
  const raw = runRailway(['service', 'list'], { json: true });
  let services = parseServiceList(raw);
  let pgName = pickPostgresName(services);
  if (pgName) {
    console.error(`Найден сервис БД: «${pgName}»`);
    return pgName;
  }
  console.error('PostgreSQL в проекте не найден — создаю плагин Postgres…');
  runRailwayAddPostgres();
  const raw2 = runRailway(['service', 'list'], { json: true });
  services = parseServiceList(raw2);
  pgName = pickPostgresName(services);
  if (!pgName) {
    console.error(
      'Не удалось определить имя сервиса Postgres. Укажите вручную:\n  export POSTGRES_SERVICE_NAME="Имя_как_в_Railway"',
    );
    process.exit(1);
  }
  console.error(`Создан/обнаружен сервис БД: «${pgName}»`);
  return pgName;
}

function setDatabaseReference(pgName) {
  const value = `DATABASE_URL=\${{${pgName}.DATABASE_URL}}`;
  console.error(`Проставляю reference на ${BOT_SERVICE}: DATABASE_URL ← \${{${pgName}.DATABASE_URL}}`);
  runRailwayNoJson(['variable', 'set', value, '-s', BOT_SERVICE]);
}

function setProductionDefaults() {
  console.error(`NODE_ENV=production для ${BOT_SERVICE}`);
  runRailwayNoJson(['variable', 'set', 'NODE_ENV=production', '-s', BOT_SERVICE]);
}

function main() {
  ensureWhoami();
  ensureLinked();
  const pgName = ensurePostgres();
  setDatabaseReference(pgName);
  setProductionDefaults();
  console.error('');
  console.error('Готово. Railway пересоберёт сервис бота.');
  console.error('Проверьте в dashboard переменные TELEGRAM_BOT_TOKEN и OPENAI_API_KEY.');
}

main();
