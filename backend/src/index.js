import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createRealtime } from './lib/realtime.js';
import authRoutes from './routes/auth.js';
import adminMenuRoutes from './routes/admin-menu.js';
import auditRoutes from './routes/audit.js';
import publicRoutes from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Allow explicit list + any localhost / 127.0.0.1 port (Live Server, Vite, etc.) */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (configuredOrigins.includes('*')) return true;
  if (configuredOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn('[cors] blocked origin:', origin);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  },
});

app.locals.realtime = createRealtime(io);

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
app.use('/image', express.static(path.resolve(__dirname, '../../image')));

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminMenuRoutes);
app.use('/api/admin/audit', auditRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = /CORS blocked/i.test(err.message) ? 403 : 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

io.on('connection', (socket) => {
  socket.emit('menu:hello', { at: new Date().toISOString() });
});

server.listen(port, host, () => {
  console.log(`Friendly Menu API listening on http://127.0.0.1:${port}`);
  console.log(`Also reachable at http://localhost:${port}`);
  console.log('CORS: localhost / 127.0.0.1 (any port) + CLIENT_ORIGIN list');
});
