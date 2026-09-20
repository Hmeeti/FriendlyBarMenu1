# Friendly Menu

## Запуск

```bash
npm install
npm run dev
```

При первом запуске сервер сам:
1. создаёт `.env` из `.env.example` (если нет)
2. создаёт SQLite БД (`prisma/dev.db`)
3. создаёт админа `ilnur000` / `9987650`

Меню: Live Server → `index.html`  
Админка: `admin.html`

API (Render): `https://friendlybarmenu1admin.onrender.com`  
(задаётся в `config.js`)

## Render Environment

Обязательно:
- `CLIENT_ORIGIN` = `https://hmeeti.github.io` (+ localhost при необходимости)
- `COOKIE_SECURE=true`
- `JWT_SECRET` = длинная случайная строка
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`

Чтобы правки из админки попадали на **все телефоны** через GitHub Pages, добавьте:
- `GITHUB_TOKEN` = Personal Access Token с правом **Contents: Read and write** на репозиторий
- `GITHUB_REPO` = `Hmeeti/FriendlyBarMenu1` (по умолчанию)
- `GITHUB_BRANCH` = `main`

После сохранения блюда сервер сам коммитит обновлённые `data.js` и `data/menu-export.json` в GitHub.
