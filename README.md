# Friendly Menu

Электронное меню ресторана с админ-панелью, REST API, real-time синхронизацией и аудитом изменений.

## Структура проекта

```text
friendly-menu/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml      # GitHub Pages (frontend)
├── index.html                    # Электронное меню (корень = GitHub Pages)
├── admin.html                    # Админ-панель
├── css/
├── js/                           # config.js, script.js, admin-panel.js…
├── image/                        # Фото блюд├── backend/                      # Node.js API + БД
│   ├── src/
│   │   ├── index.js              # Express + Socket.io
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── lib/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── data/
│   │   └── menu-export.json      # Сид меню
│   ├── uploads/                  # Загруженные изображения
│   ├── .env.example
│   ├── .env.production.example
│   └── package.json
├── admin-web/                    # Опциональная React-админка (Vite)
│   ├── src/
│   └── package.json
├── docs/
│   ├── ADMIN.md
│   └── RUN.md
├── scripts/
│   └── legacy/                   # Вспомогательные скрипты
├── docker-compose.yml            # PostgreSQL для продакшена
├── package.json                  # Корневые npm-скрипты
├── .gitignore
└── README.md
```

## Требования

- Node.js **20+**
- npm 10+
- (опционально) Docker — для PostgreSQL

## Быстрый старт (локально)

### 1. Backend API

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

API: **http://127.0.0.1:4000**  
Проверка: http://127.0.0.1:4000/api/health → `{"ok":true}`

Из корня репозитория можно так:

```bash
npm run setup
npm run dev:api
```

### 2. Frontend (электронное меню)

Откройте **корень проекта** через **Live Server** (VS Code / Cursor):

- Меню: `http://127.0.0.1:5501/index.html` (порт может быть 5500/5501)
- Админка: `http://127.0.0.1:5501/admin.html`

Либо из корня:

```bash
npx --yes serve . -p 5501
```

### 3. Вход в админ-панель

1. На странице меню нажмите кнопку **Admin** (в шапке)  
   или откройте `admin.html`
2. Логин / пароль по умолчанию:

| Поле | Значение |
|---|---|
| Login | `ilnur000` |
| Password | `9987650` |

> Перед продакшеном смените пароль в `backend/.env` (`ADMIN_PASSWORD`) и перезапустите `npm run db:seed`.

### 4. (Опционально) React Admin

```bash
cd admin-web
npm install
npm run dev
```

Откроется http://localhost:5173 (проксирует `/api` на backend).

## Переменные окружения (backend)

Скопируйте `backend/.env.example` → `backend/.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me"
PORT=4000
HOST=0.0.0.0
CLIENT_ORIGIN="http://127.0.0.1:5501,http://localhost:5501"
ADMIN_USERNAME="ilnur000"
ADMIN_PASSWORD="9987650"
```

Для продакшена см. `backend/.env.production.example`.

## Конфиг frontend → API

Файл `js/config.js`:

```js
window.FRIENDLY_CONFIG = {
  // Локально можно оставить пустым (auto: hostname:4000)
  apiBase: '',
  // После деплоя API, например:
  // apiBase: 'https://your-api.onrender.com',
};
```

## Деплой на GitHub

```bash
git remote add origin https://github.com/<USER>/<REPO>.git
git branch -M main
git push -u origin main
```

1. **GitHub Pages** (frontend): Settings → Pages → Source: **GitHub Actions**
2. **Backend**: Render / Railway / Fly — Root Directory = `backend`
3. В `js/config.js` укажите `apiBase` на URL вашего API
4. В `CLIENT_ORIGIN` добавьте URL GitHub Pages

## Основные API-эндпоинты

| Method | Path | Описание |
|---|---|---|
| GET | `/api/health` | Healthcheck |
| GET | `/api/menu` | Публичное меню |
| POST | `/api/auth/login` | Вход админа |
| GET/PATCH | `/api/admin/items` | CRUD блюд |
| GET/POST | `/api/admin/categories` | Категории |
| GET | `/api/admin/audit` | Журнал действий |

## Безопасность

- `backend/.env` **не коммитится** (см. `.gitignore`)
- JWT в httpOnly cookie (+ Bearer token)
- CORS разрешает localhost / 127.0.0.1 и список `CLIENT_ORIGIN`
- Роли: `SUPER_ADMIN`, `MANAGER`

## Лицензия

Private — все права защищены.

