# Деплой

**Рекомендуем для MVP:** [Railway](DEPLOY-RAILWAY.md) — без своего сервера, Postgres в один клик.

---

# Деплой на VPS

Бот работает 24/7 без вашего Mac: Telegram long polling + Postgres + OpenAI с сервера.

## Что нужно

1. VPS (Ubuntu 22/04/24.04), 1 GB RAM достаточно для MVP  
   Примеры: [Hetzner CX22](https://www.hetzner.com/cloud), Timeweb, Selectel  
2. SSH-доступ: `root@IP` или пользователь с sudo  
3. Секреты: токен бота, `OPENAI_API_KEY`, надёжный пароль Postgres  

## Быстрый деплой с Mac

### 1. Подготовить `.env` для сервера

```bash
cp env.production.example .env
```

Заполните `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `POSTGRES_PASSWORD` (длинный случайный).  
`DATABASE_URL` должен использовать тот же пароль и хост `postgres` (как в примере).

### 2. Первый раз на VPS — Docker

```bash
export DEPLOY_HOST=root@ВАШ_IP
scp scripts/vps-bootstrap.sh ${DEPLOY_HOST}:/tmp/
ssh ${DEPLOY_HOST} bash /tmp/vps-bootstrap.sh
```

### 3. Выкатить проект

```bash
export DEPLOY_HOST=root@ВАШ_IP
npm run deploy:vps
```

Скрипт: rsync кода → копия `.env` → `docker compose -f docker-compose.prod.yml up -d --build`.

### 4. Проверка

- На сервере: `curl http://127.0.0.1:3000/health`  
- В Telegram: `/start`  

Логи: `ssh root@IP 'cd /opt/diary-bot && docker compose -f docker-compose.prod.yml logs -f bot'`

## Обновление после изменений в коде

```bash
export DEPLOY_HOST=root@ВАШ_IP
npm run deploy:vps
```

## OpenAI с VPS

На многих EU/US серверах OpenAI доступен без VPN. После деплоя, если голос/AI не работают:

```bash
ssh root@IP 'cd /opt/diary-bot && docker compose -f docker-compose.prod.yml exec bot npm run check-openai'
```

При блокировке региона — `OPENAI_HTTPS_PROXY` в `.env` на сервере.

## Безопасность

- Postgres **не** открыт наружу (только внутренняя сеть Docker).  
- Health только на `127.0.0.1:3000` на VPS.  
- Не коммитьте `.env`. Если токен светился — перевыпустите у @BotFather.  

## Ручной деплой на сервере

```bash
git clone <repo> /opt/diary-bot && cd /opt/diary-bot
cp env.production.example .env && nano .env
docker compose -f docker-compose.prod.yml up -d --build
```
