# Деплой на Railway

Один always-on сервис для бота + managed PostgreSQL. Mac может быть выключен.

## Важно

- **Только 1 реплика** бота (long polling; две копии = конфликт). В `railway.toml` уже `numReplicas = 1`.
- На бесплатном/ trial-плане сервис может **засыпать** — для стабильного теста нужен платный Hobby (~$5/мес).
- OpenAI с датацентра Railway (часто US) обычно **без VPN**.

## Вариант A — через сайт (проще)

### 1. Репозиторий

Залейте проект на GitHub (приватный репо — ок).

### 2. Railway

1. [railway.com](https://railway.com) → New Project → **Deploy from GitHub repo** → выберите репозиторий.
2. Railway увидит `Dockerfile` и `railway.toml`.

### 3. PostgreSQL

1. В проекте: **+ New** → **Database** → **PostgreSQL**.
2. Откройте сервис бота → **Variables** → **Add Reference** → выберите Postgres → `DATABASE_URL`.

### 4. Переменные бота

В сервисе **bot** (не Postgres) → **Variables**:

| Переменная | Значение |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | от @BotFather |
| `OPENAI_API_KEY` | ключ OpenAI |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` (опционально) |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | reference из Postgres (шаг 3) |

`PORT` Railway подставит сам — приложение его использует для health.

### 5. Деплой

Save → Railway соберёт Docker-образ и запустит. В логах должно быть:

- `Database connection established`
- `Telegram bot launched (long polling)`

### 6. Проверка

- **Deployments** → View logs  
- Telegram: `/start`

---

## Вариант B — Railway CLI с Mac

```bash
npm i -g @railway/cli
railway login
cd "/Users/boss/Documents/MVP Дневник"
railway init          # новый проект или link
railway add -d postgres
railway service       # выберите сервис бота (не postgres)
railway variables set TELEGRAM_BOT_TOKEN="..."
railway variables set OPENAI_API_KEY="..."
railway variables set NODE_ENV=production
# DATABASE_URL подтянется после link postgres — в dashboard: Reference Variable
railway up
```

Логи: `railway logs`

---

## Обновления

Push в GitHub → auto-deploy, или снова `railway up` из папки проекта.

## Если бот молчит

1. **Logs** — ошибка `DATABASE_URL` / OpenAI / Telegram token.  
2. `npm run check-openai` локально с тем же ключом.  
3. Убедитесь, что запущен **один** деплой (не два сервиса с одним токеном).  
4. Сервис не в sleep — откройте dashboard или включите Hobby.

## Локальная разработка

Как раньше: `docker compose up -d` (только Postgres) + `npm run dev`.
