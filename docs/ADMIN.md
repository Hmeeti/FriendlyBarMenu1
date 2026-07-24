# Friendly Menu — Admin Platform

Production-oriented admin stack for the existing static electronic menu.

## Stack (recommendation)

| Layer | Choice | Why |
|---|---|---|
| Admin UI | **Vite + React + Tailwind** | Faster SPA than Next.js for an authenticated internal panel |
| API | **Node.js + Express** | Same language as the menu frontend, simple deploy |
| Realtime | **Socket.io** | Instant guest-menu sync (WebSocket + polling fallback) |
| DB | **Prisma + SQLite (local) / PostgreSQL (prod)** | Relational fit for categories/items/RBAC/audit diffs |
| Auth | **JWT in httpOnly cookie** (+ Bearer supported) | CSRF-friendly same-site cookie; no localStorage tokens |

> Next.js is fine if you later want SSR/SEO for a public marketing site. For this admin panel it adds cost without benefit.

## Architecture

```
┌─────────────────┐     REST + cookie      ┌──────────────────┐
│  Admin (Vite)   │◄──────────────────────►│  Express API     │
│  :5173          │                        │  :4000           │
└────────┬────────┘                        │  Prisma → PG     │
         │ Socket.io                       │  /uploads        │
         └────────────────────────────────►│                  │
                                           └────────┬─────────┘
┌─────────────────┐   GET /api/menu + WS            │
│ Guest menu      │◄────────────────────────────────┘
│ index.html      │   menu-live.js overlays static data
└─────────────────┘
```

### RBAC

| Role | Can |
|---|---|
| `SUPER_ADMIN` | Everything + delete categories/items + manage admins + purge old logs |
| `MANAGER` | Create/update categories & items, variants, uploads, stock toggles |

### Audit trail

Every mutating action writes `AuditLog` with: timestamp, admin id/email/name, `CREATE|UPDATE|DELETE|LOGIN|LOGOUT`, entity type/id/label, human summary, JSON `before`/`after` for diff view.

### Realtime

After each menu mutation the API emits `menu:changed`. Guest pages refetch `/api/menu` and call `FriendlyMenu.applyLiveMenu(...)`.

## Folder layout

```
server/                 Express + Prisma + Socket.io
  prisma/schema.prisma  DB models
  prisma/seed.js        Seeds admin + existing menu JSON
  data/menu-export.json Snapshot of current static menu
  src/routes/           auth, admin-menu, audit, public
admin/                  React admin dashboard
js/menu-live.js         Guest menu API/Socket bridge
docker-compose.yml      Local PostgreSQL
```

## API map

### Public
- `GET /api/health`
- `GET /api/menu` — sections/items shaped for the current frontend
- `GET /uploads/:file` — uploaded images
- `GET /image/*` — legacy dish photos

### Auth
- `POST /api/auth/login` `{ email, password }` → sets `fm_admin_token` cookie
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET|POST /api/auth/admins` (SUPER_ADMIN)

### Admin menu
- `GET|POST /api/admin/categories`
- `PATCH|DELETE /api/admin/categories/:id`
- `GET|POST /api/admin/items`
- `GET|PATCH|DELETE /api/admin/items/:id`
- `POST /api/admin/items/:id/variants`
- `PATCH|DELETE /api/admin/variants/:id`
- `POST /api/admin/upload` `multipart/form-data` field `image`

### Audit
- `GET /api/admin/audit?page&limit&q&action&entityType&adminId`
- `GET /api/admin/audit/:id`
- `DELETE /api/admin/audit?olderThanDays=90` (SUPER_ADMIN)

## Integrate into this project (step-by-step)

### 1. Database

**Local (default):** SQLite file `server/prisma/dev.db` — no Docker required.

**Production:** set `provider = "postgresql"` in `server/prisma/schema.prisma`, point `DATABASE_URL` at Postgres, then `docker compose up -d` (or managed Postgres).

### 2. Install & migrate API

```bash
cd server
cp .env.example .env   # already present in this repo
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Default Super Admin:
- email: `admin@friendly.local`
- password: `ChangeMe123!` ← change immediately

### 3. Start admin UI

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5173

### 4. Guest menu already wired

`index.html` loads `js/menu-live.js`, which:
1. Tries `GET http://localhost:4000/api/menu`
2. Replaces static `MENU_SECTIONS` / `MENU_ITEMS` / `ITEM_DETAILS`
3. Listens for `menu:changed` and refreshes without reload
4. Falls back to static `menu-data.js` if the API is down

Serve the guest menu from any static server (Live Server, `npx serve`, etc.). If the guest origin differs, ensure it is listed in `CLIENT_ORIGIN` in `server/.env`.

### 5. Production notes

- Set strong `JWT_SECRET`, `COOKIE_SECURE=true` (HTTPS), rotate `ADMIN_PASSWORD`
- Put Nginx/Caddy in front: `/` → guest static, `/admin` → admin build, `/api` + `/socket.io` + `/uploads` → Node
- Persist `server/uploads` and Postgres volumes
- Restrict CORS to real origins only

## Seed source

`tools` export lives at `server/data/menu-export.json` (generated from `js/menu-data.js` + `js/item-details.js`). Re-export anytime:

```bash
node -e "global.window={}; const fs=require('fs'); eval(fs.readFileSync('js/menu-data.js','utf8')); eval(fs.readFileSync('js/item-details.js','utf8')); fs.writeFileSync('server/data/menu-export.json', JSON.stringify({sections:window.MENU_SECTIONS, details:window.ITEM_DETAILS||{}}, null, 2));"
```

## What was deliberately kept lean

- Modifier *groups* exist in the schema (ready for UI) but the admin ships variants + stock first — add group CRUD when the POS needs toppings.
- No Redis/session store yet — JWT cookies are enough until you need revoke-all; add a denylist then.
- Local disk uploads — swap Multer destination to S3/R2 when you deploy multi-instance.
