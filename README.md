# Friendly Menu

Электронное меню + админ-панель + API.

## Структура

```text
/
├── index.html      # меню
├── admin.html      # админка
├── style.css       # все стили
├── data.js         # данные меню
├── app.js          # логика меню
├── admin.js        # логика админки
├── image/          # фото
├── backend/        # API (Express + Prisma)
├── package.json
└── README.md
```

## Запуск

```bash
# API
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Меню: откройте `index.html` через Live Server.  
Админка: `admin.html` — логин `ilnur000` / пароль `9987650`.
