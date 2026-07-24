# Friendly Menu

```text
/
├── index.html   # меню
├── admin.html   # админка
├── style.css
├── data.js      # данные блюд
├── app.js       # логика меню + realtime
├── admin.js     # логика админки
├── image/
└── backend/
    ├── server.js          # весь API в одном файле
    ├── prisma/
    ├── data/menu-export.json
    └── uploads/
```

## Run

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Меню: Live Server → `index.html`  
Админка: `admin.html` → `ilnur000` / `9987650`
