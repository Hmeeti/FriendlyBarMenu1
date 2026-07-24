# Friendly Menu

```text
/
├── index.html / admin.html / style.css / data.js / app.js / admin.js
├── image/
├── server.js          # API
├── package.json
├── prisma/            # схема БД + seed
├── data/              # сид меню
├── uploads/
└── node_modules/      # одна папка зависимостей (не в git)
```

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

> `.env` и `prisma/*.db` не в Git — это нормально, они поднимаются автоматически.
