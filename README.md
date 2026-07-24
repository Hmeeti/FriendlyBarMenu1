# Friendly Menu


<<<<<<< HEAD
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

На Render в Environment добавьте:
- `CLIENT_ORIGIN` = URL вашего GitHub Pages (и localhost при необходимости)
- `COOKIE_SECURE=true`
- `JWT_SECRET` = длинная случайная строка
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
=======
>>>>>>> 09f00c50eaedeb2dac85e3c8d811db4d87d8dc90
