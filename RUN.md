# How to run Friendly Menu (API + Live Server)

## Terminal 1 — Backend (required)

```powershell
cd "C:\Users\ruslan\Desktop\Friendly menu — копия\server"
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

You should see:
```
Friendly Menu API listening on http://127.0.0.1:4000
```

Quick health check in browser: http://127.0.0.1:4000/api/health

## Terminal 2 — Frontend (Live Server)

Open the project folder in VS Code / Cursor and start **Live Server** on `index.html` or `admin.html`.

Your admin URL should look like:
`http://127.0.0.1:5501/admin.html`

## Login

- Login: `ilnur000`
- Password: `9987650`

## If you still see "Failed to fetch"

1. Confirm API is up: open http://127.0.0.1:4000/api/health
2. Hard-refresh admin page (`Ctrl+F5`)
3. Use the **same host** in both URLs (`127.0.0.1` with `127.0.0.1`, not mix with `localhost`)
4. Restart API after pulling these CORS fixes:
   ```powershell
   cd server
   npm run dev
   ```
