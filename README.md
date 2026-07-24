# Friendly Menu

Электронное меню ресторана + админ-панель с API, real-time обновлениями и аудитом.

## Стек

| Часть | Технологии |
|---|---|
| Гостевое меню | HTML / CSS / JS |
| Админка (простая) | `admin.html` |
| Админка (React) | Vite + React (`admin/`) |
| API | Node.js + Express + Socket.io + Prisma |
| БД | SQLite (локально) / PostgreSQL (продакшен) |

## Быстрый старт (локально)

```bash
# 1) API
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
# → http://127.0.0.1:4000

# 2) Гостевое меню
# Откройте index.html через Live Server (порт 5500/5501)

# 3) Админка
# http://127.0.0.1:5501/admin.html
```

**Логин админа (по умолчанию):**
- Login: `ilnur000`
- Password: `9987650`

Смените пароль в `server/.env` перед продакшеном.

## Структура

```
index.html          # электронное меню
admin.html          # админ-панель (категории + редактирование блюд)
js/                 # клиентские скрипты
css/                # стили
image/              # фото блюд
server/             # Express API + Prisma
admin/              # React-админка (опционально)
docker-compose.yml  # PostgreSQL для продакшена
```

## Деплой на GitHub

### 1. Залить код

```bash
git init
git add .
git commit -m "Initial commit: Friendly Menu with admin API"
gh repo create friendly-menu --public --source=. --remote=origin --push
```

Или создайте репозиторий на github.com и:

```bash
git remote add origin https://github.com/<USER>/<REPO>.git
git branch -M main
git push -u origin main
```

### 2. GitHub Pages (статическое меню)

1. Settings → Pages → Source: **GitHub Actions**
2. Workflow уже лежит в `.github/workflows/deploy-pages.yml`
3. После push на `main` меню будет на:
   `https://<USER>.github.io/<REPO>/`

**Важно:** для сохранения изменений из админки нужен отдельный backend (см. ниже).  
В `js/config.js` укажите URL API:

```js
window.FRIENDLY_CONFIG = {
  apiBase: 'https://your-api.onrender.com',
};
```

### 3. Backend (Render / Railway / Fly.io)

Рекомендуемый бесплатный вариант — [Render](https://render.com):

1. New → Web Service → подключите этот GitHub-репозиторий
2. Root Directory: `server`
3. Build Command:
   ```bash
   npm install && npx prisma generate && npx prisma db push
   ```
4. Start Command: `npm start`
5. Environment:
   - `DATABASE_URL` — Postgres (Render Postgres) или оставьте SQLite только для теста
   - `JWT_SECRET` — длинная случайная строка
   - `CLIENT_ORIGIN` — `https://<USER>.github.io` (и ваш custom domain)
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL`
   - `COOKIE_SECURE=true`
   - `PORT=4000` (Render подставит свой PORT — в коде уже `process.env.PORT`)

Для PostgreSQL в `server/prisma/schema.prisma` смените:

```prisma
provider = "postgresql"
```

Затем в Render:

```bash
npx prisma db push && npm run db:seed && npm start
```

### 4. CORS

В `CLIENT_ORIGIN` перечислите все фронтенд-origins через запятую, например:

```
https://username.github.io,https://username.github.io/friendly-menu
```

Локальные `localhost` / `127.0.0.1` уже разрешены в коде API.

## Документация API

См. [ADMIN.md](./ADMIN.md) и [RUN.md](./RUN.md).

## Лицензия

Private / All rights reserved — по желанию владельца.
