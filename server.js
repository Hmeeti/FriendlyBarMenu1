import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// After Git clone .env and SQLite DB are missing — recreate before anything else
const envPath = path.join(__dirname, '.env');
const envExample = path.join(__dirname, '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envPath);
  console.log('[setup] Created .env from .env.example');
}
dotenv.config({ path: envPath });

const prisma = new PrismaClient();
const COOKIE = 'fm_admin_token';
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Ensure SQLite schema + default admins exist (safe after fresh git clone) */
async function ensureDatabaseAndAdmin() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log('[setup] Database missing or empty — running prisma db push…');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: __dirname });
  }

  const ensureAdmin = async ({ username, email, name, password, role = 'SUPER_ADMIN' }) => {
    const u = String(username).toLowerCase();
    const e = String(email || `${u}@friendly.local`).toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    let existing = null;
    try {
      existing =
        (await prisma.adminUser.findUnique({ where: { username: u } })) ||
        (await prisma.adminUser.findUnique({ where: { email: e } }));
    } catch {
      console.log('[setup] Tables missing — running prisma db push…');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: __dirname });
      existing =
        (await prisma.adminUser.findUnique({ where: { username: u } })) ||
        (await prisma.adminUser.findUnique({ where: { email: e } }));
    }

    if (!existing) {
      await prisma.adminUser.create({
        data: { username: u, email: e, name, passwordHash, role, isActive: true },
      });
      console.log(`[setup] Created admin: ${u} (${role})`);
    } else {
      // Env is source of truth for bootstrap admins — keeps Render logins working after SQLite wipes.
      // Set RESET_ADMIN_PASSWORD=0 to keep DB password and only refresh profile fields.
      const syncPass = process.env.RESET_ADMIN_PASSWORD !== '0';
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: {
          username: u,
          email: e,
          name,
          role,
          isActive: true,
          ...(syncPass ? { passwordHash } : {}),
        },
      });
      if (syncPass) console.log(`[setup] Synced admin from env: ${u}`);
    }
  };

  await ensureAdmin({
    username: process.env.ADMIN_USERNAME || 'ilnur000',
    email: process.env.ADMIN_EMAIL || 'ilnur000@friendly.local',
    name: process.env.ADMIN_NAME || 'Ilnur',
    password: process.env.ADMIN_PASSWORD || '9987650',
    role: 'SUPER_ADMIN',
  });

  // Owner / full-access auditor
  await ensureAdmin({
    username: process.env.OWNER_USERNAME || 'hmeeti',
    email: process.env.OWNER_EMAIL || 'hmeeti@friendly.local',
    name: process.env.OWNER_NAME || 'Hmeeti',
    password: process.env.OWNER_PASSWORD || '2289073',
    role: 'SUPER_ADMIN',
  });

  if (!(process.env.JWT_SECRET || '').trim() || (process.env.JWT_SECRET || '').length < 24) {
    throw new Error('JWT_SECRET must be set to a strong value (24+ chars). See .env.example.');
  }

  try {
    await prisma.visit.findFirst({ take: 1 });
  } catch {
    console.log('[setup] Visit table missing — running prisma db push…');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: __dirname });
  }

  // Fresh Render/SQLite often has zero dishes — keep guest menu alive from data.js
  try {
    const catCount = await prisma.category.count();
    if (catCount === 0 && process.env.AUTO_SEED !== '0') {
      await seedMenuFromDataJs();
    }
  } catch (err) {
    console.error('[setup] Auto-seed failed:', err?.message || err);
  }
}

async function seedMenuFromDataJs() {
  const dataPath = path.join(__dirname, 'data.js');
  if (!fs.existsSync(dataPath)) {
    console.warn('[setup] data.js missing — skip auto-seed');
    return;
  }
  const { runInNewContext } = await import('vm');
  const code = fs.readFileSync(dataPath, 'utf8');
  const sandbox = { window: {}, console };
  runInNewContext(code, sandbox, { timeout: 15000 });
  const sections = sandbox.window.MENU_SECTIONS || [];
  const details = sandbox.window.ITEM_DETAILS || {};
  let items = 0;
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const title = sec.title || `Section ${i + 1}`;
    const baseSlug = sec.anchor || slugify(title);
    const cat = await prisma.category.create({
      data: { title, slug: `${baseSlug}-${i}`, sortOrder: i, isActive: true },
    });
    for (let j = 0; j < (sec.items || []).length; j++) {
      const it = sec.items[j];
      const d = details[String(it.id)] || {};
      const legacyId = Number(it.id);
      try {
        await prisma.menuItem.create({
          data: {
            legacyId: Number.isFinite(legacyId) ? legacyId : undefined,
            categoryId: cat.id,
            name: it.name || d.name || `Item ${it.id}`,
            description: d.desc || it.desc || '',
            weight: it.weight || '',
            price: Number(it.price ?? d.price) || 0,
            imageUrl: it.img || d.img || 'image/nono.png',
            sortOrder: j,
            isActive: true,
          },
        });
      } catch {
        await prisma.menuItem.create({
          data: {
            categoryId: cat.id,
            name: it.name || d.name || `Item ${it.id}`,
            description: d.desc || it.desc || '',
            weight: it.weight || '',
            price: Number(it.price ?? d.price) || 0,
            imageUrl: it.img || d.img || 'image/nono.png',
            sortOrder: j,
            isActive: true,
          },
        });
      }
      items++;
    }
  }
  console.log(`[setup] Auto-seeded ${sections.length} categories / ${items} dishes from data.js`);
}

const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const defaultOrigins = [
  'https://hmeeti.github.io',
  'https://friendlybarmenu1admin.onrender.com',
];
const allow = (o) => {
  if (!o) return true;
  if (origins.includes('*')) return !isProd;
  if (origins.length && origins.includes(o)) return true;
  if (defaultOrigins.includes(o)) return true;
  // Any GitHub Pages project under this user/org host
  if (/^https:\/\/hmeeti\.github\.io$/i.test(o)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o)) return true;
  if (!origins.length && !isProd) return true;
  return false;
};


const corsOpts = {
  origin: (o, cb) => (allow(o) ? cb(null, true) : cb(new Error(`CORS blocked for origin: ${o}`))),
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOpts });
const bump = (event, payload = {}) => io.emit('menu:changed', { event, at: new Date().toISOString(), ...payload });

app.set('trust proxy', 1);
app.use(cors(corsOpts));
app.options(/.*/, cors(corsOpts));
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
}));
app.use('/image', express.static(path.join(__dirname, 'image')));

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const ALLOWED_UPLOAD = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, uploadDir),
    filename: (_r, f, cb) => {
      const ext = ALLOWED_UPLOAD[f.mimetype] || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) =>
    ALLOWED_UPLOAD[f.mimetype] ? cb(null, true) : cb(new Error('Only jpeg/png/webp/gif allowed')),
});

function sanitizeImageUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || /[<>"'`]/.test(s) || /[\s]/.test(s)) return 'image/nono.png';
  if (/^(javascript|data|vbscript):/i.test(s)) return 'image/nono.png';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'image/nono.png';
      return u.href;
    } catch {
      return 'image/nono.png';
    }
  }
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(s)) return s;
  if (/^image\/[A-Za-z0-9._/-]+$/.test(s)) return s;
  return 'image/nono.png';
}

const cookieSecure = process.env.COOKIE_SECURE === 'true' || isProd;
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure,
  path: '/',
};

const itemInclude = {
  category: true,
  variants: { orderBy: { sortOrder: 'asc' } },
  modifiers: { include: { modifier: { include: { group: true } } } },
};

const slugify = (t) =>
  String(t).toLowerCase().replace(/[^a-z0-9а-яёәіңғүұқөһ\-]+/gi, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || `cat-${Date.now()}`;

const sign = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
const setCookie = (res, token) =>
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: 8 * 3600e3 });
const readToken = (req) => req.cookies?.[COOKIE] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

const loginHits = new Map();
function allowLoginAttempt(key) {
  const now = Date.now();
  const windowMs = 15 * 60e3;
  let row = loginHits.get(key);
  if (!row || now > row.reset) row = { n: 0, reset: now + windowMs };
  row.n += 1;
  loginHits.set(key, row);
  return row.n <= 20;
}

const DUMMY_HASH = bcrypt.hashSync('__friendly_dummy_login__', 10);

async function audit({ admin, action, entityType, entityId = null, entityLabel = '', summary, before = null, after = null, req = null }) {
  return prisma.auditLog.create({
    data: {
      adminId: admin?.id ?? null,
      adminEmail: admin?.email ?? 'system',
      adminName: admin?.name ?? 'system',
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      entityLabel,
      summary,
      before: before ?? undefined,
      after: after ?? undefined,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.headers?.['user-agent'] || null,
    },
  });
}

function diff(before, after, fields) {
  return fields
    .filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    .map((k) => ({ field: k, from: before?.[k] ?? null, to: after?.[k] ?? null }));
}

function summarize(name, label, changes) {
  if (!changes.length) return `${name} updated ${label} (no field changes)`;
  return `${name} updated ${label}: ${changes.map((c) => (c.field === 'price' ? `price from ${c.from} to ${c.to}` : `${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`)).join('; ')}`;
}

async function auth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.adminUser.findUnique({ where: { id: jwt.verify(token, process.env.JWT_SECRET).sub } });
    if (!user?.isActive) return res.status(401).json({ error: 'Unauthorized' });
    req.admin = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

const role = (...roles) => (req, res, next) => (!req.admin || !roles.includes(req.admin.role) ? res.status(403).json({ error: 'Forbidden' }) : next());
const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, name: u.name, role: u.role });

// ——— Public ———
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const categories = await prisma.category.count();
    res.json({ ok: true, db: true, categories, at: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ ok: false, db: false, error: 'db_unavailable' });
  }
});

app.get('/api/menu', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          variants: { orderBy: { sortOrder: 'asc' } },
          modifiers: { include: { modifier: { include: { group: true } } } },
        },
      },
    },
  });

  const sections = categories.map((c) => ({
    id: c.id,
    title: c.title,
    anchor: c.slug,
    items: c.items.map((item) => ({
      id: item.legacyId ?? item.id,
      dbId: item.id,
      name: item.name,
      weight: item.weight,
      price: item.price,
      priceDisplay: `${item.price}тг`,
      img: item.imageUrl,
      desc: item.description,
      availability: item.availability,
      variants: item.variants.map((v) => ({ id: v.id, name: v.name, priceDelta: v.priceDelta, availability: v.availability })),
      modifiers: item.modifiers.map((m) => ({
        id: m.modifier.id,
        name: m.modifier.name,
        priceDelta: m.modifier.priceDelta,
        group: m.modifier.group?.name,
        availability: m.modifier.availability,
      })),
    })),
  }));

  const items = {};
  const details = {};
  for (const s of sections) {
    for (const it of s.items) {
      const k = String(it.id);
      items[k] = { name: it.name, price: it.price, img: it.img, desc: it.desc, availability: it.availability };
      details[k] = { name: it.name, price: it.price, img: it.img, desc: it.desc };
    }
  }
  res.set('Cache-Control', 'no-store').json({ updatedAt: new Date().toISOString(), sections, items, details });
});

// ——— Auth ———
app.post('/api/auth/login', async (req, res) => {
  const loginId = String(req.body.login || req.body.username || req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
  if (!allowLoginAttempt(`${ip}:${loginId || '_'}`)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  if (!loginId || password.length < 6) return res.status(400).json({ error: 'Invalid credentials payload' });
  const user = await prisma.adminUser.findFirst({ where: { OR: [{ username: loginId }, { email: loginId }] } });
  const hash = user?.passwordHash || DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user?.isActive || !ok) {
    return res.status(401).json({ error: 'Invalid login or password' });
  }
  const token = sign(user);
  setCookie(res, token);
  await audit({ admin: user, action: 'LOGIN', entityType: 'AdminUser', entityId: user.id, entityLabel: user.username || user.email, summary: `${user.name} logged in`, req });
  res.json({ user: publicUser(user), token });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await audit({ admin: req.admin, action: 'LOGOUT', entityType: 'AdminUser', entityId: req.admin.id, entityLabel: req.admin.email, summary: `${req.admin.name} logged out`, req });
  res.clearCookie(COOKIE, cookieOpts);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.admin) }));

app.get('/api/auth/admins', auth, role('SUPER_ADMIN'), async (_req, res) => {
  res.json({
    users: await prisma.adminUser.findMany({
      select: { id: true, username: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  });
});

app.post('/api/auth/admins', auth, role('SUPER_ADMIN'), async (req, res) => {
  const { username, email, name, password, role: r = 'MANAGER' } = req.body || {};
  if (!username || username.length < 3 || !email || !name || !password || password.length < 7) {
    return res.status(400).json({ error: 'Invalid admin payload' });
  }
  const created = await prisma.adminUser.create({
    data: {
      username: String(username).toLowerCase(),
      email: String(email).toLowerCase(),
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: r === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'MANAGER',
    },
  });
  await audit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'AdminUser',
    entityId: created.id,
    entityLabel: created.username,
    summary: `${req.admin.name} created admin ${created.username} (${created.role})`,
    after: publicUser(created),
    req,
  });
  res.status(201).json({ user: publicUser(created) });
});

app.post('/api/auth/admins/:id/password', auth, role('SUPER_ADMIN'), async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 7) return res.status(400).json({ error: 'Password must be 7+ chars' });
  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Not found' });
  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(password, 12), isActive: true },
  });
  await audit({
    admin: req.admin,
    action: 'UPDATE',
    entityType: 'AdminUser',
    entityId: updated.id,
    entityLabel: updated.username,
    summary: `${req.admin.name} reset password for ${updated.username}`,
    req,
  });
  res.json({ ok: true, user: publicUser(updated) });
});

// ——— Admin menu ———
app.get('/api/admin/categories', auth, async (_req, res) => {
  res.json({
    categories: await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: { _count: { select: { items: true } } },
    }),
  });
});

app.post('/api/admin/categories', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title required' });
  const created = await prisma.category.create({
    data: {
      title,
      slug: req.body.slug || slugify(title),
      sortOrder: Number(req.body.sortOrder) || 0,
      isActive: req.body.isActive !== false,
    },
  });
  await audit({ admin: req.admin, action: 'CREATE', entityType: 'Category', entityId: created.id, entityLabel: created.title, summary: `${req.admin.name} created category "${created.title}"`, after: created, req });
  bump('category.created', { categoryId: created.id });
  res.status(201).json({ category: created });
});

app.patch('/api/admin/categories/:id', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  const data = {};
  for (const k of ['title', 'slug', 'sortOrder', 'isActive']) if (k in req.body) data[k] = req.body[k];
  const updated = await prisma.category.update({ where: { id: before.id }, data });
  await audit({ admin: req.admin, action: 'UPDATE', entityType: 'Category', entityId: updated.id, entityLabel: updated.title, summary: summarize(req.admin.name, `category "${updated.title}"`, diff(before, updated, Object.keys(data))), before, after: updated, req });
  bump('category.updated', { categoryId: updated.id });
  res.json({ category: updated });
});

app.delete('/api/admin/categories/:id', auth, role('SUPER_ADMIN'), async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  await prisma.category.delete({ where: { id: before.id } });
  await audit({ admin: req.admin, action: 'DELETE', entityType: 'Category', entityId: before.id, entityLabel: before.title, summary: `${req.admin.name} deleted category "${before.title}"`, before, req });
  bump('category.deleted', { categoryId: before.id });
  res.json({ ok: true });
});

app.get('/api/admin/items', auth, async (req, res) => {
  const where = {};
  if (req.query.categoryId) where.categoryId = String(req.query.categoryId);
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ name: { contains: q } }, { description: { contains: q } }];
  }
  res.json({ items: await prisma.menuItem.findMany({ where, include: itemInclude, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }) });
});

app.get('/api/admin/items/:id', auth, async (req, res) => {
  const item = await prisma.menuItem.findUnique({ where: { id: req.params.id }, include: itemInclude });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ item });
});

app.post('/api/admin/items', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const { categoryId, name, price } = req.body || {};
  if (!categoryId || !name || price == null) return res.status(400).json({ error: 'categoryId, name, price required' });
  const agg = await prisma.menuItem.aggregate({ _max: { legacyId: true } });
  const legacyId =
    req.body.legacyId != null && Number.isFinite(Number(req.body.legacyId))
      ? Number(req.body.legacyId)
      : (agg._max.legacyId || 1000) + 1;
  const created = await prisma.menuItem.create({
    data: {
      legacyId,
      categoryId,
      name,
      description: req.body.description ?? '',
      weight: req.body.weight ?? '',
      price: Number(price) || 0,
      imageUrl: sanitizeImageUrl(req.body.imageUrl ?? 'image/nono.png'),
      availability: req.body.availability === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK',
      isActive: req.body.isActive !== false,
      sortOrder: Number(req.body.sortOrder) || 0,
    },
    include: itemInclude,
  });
  await audit({ admin: req.admin, action: 'CREATE', entityType: 'MenuItem', entityId: created.id, entityLabel: created.name, summary: `${req.admin.name} created dish "${created.name}" at ${created.price}`, after: created, req });
  bump('item.created', { itemId: created.id });
  res.status(201).json({ item: created });
});

app.patch('/api/admin/items/:id', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  const fields = ['name', 'description', 'weight', 'price', 'imageUrl', 'availability', 'isActive', 'sortOrder', 'categoryId'];
  const data = {};
  for (const k of fields) if (k in req.body) data[k] = req.body[k];
  if ('price' in data) data.price = Number(data.price) || 0;
  if ('imageUrl' in data) data.imageUrl = sanitizeImageUrl(data.imageUrl);
  const updated = await prisma.menuItem.update({ where: { id: before.id }, data, include: itemInclude });
  await audit({ admin: req.admin, action: 'UPDATE', entityType: 'MenuItem', entityId: updated.id, entityLabel: updated.name, summary: summarize(req.admin.name, `dish "${updated.name}"`, diff(before, updated, Object.keys(data))), before, after: updated, req });
  bump('item.updated', { itemId: updated.id });
  res.json({ item: updated });
});

app.delete('/api/admin/items/:id', auth, role('SUPER_ADMIN'), async (req, res) => {
  const before = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  await prisma.menuItem.delete({ where: { id: before.id } });
  await audit({ admin: req.admin, action: 'DELETE', entityType: 'MenuItem', entityId: before.id, entityLabel: before.name, summary: `${req.admin.name} deleted dish "${before.name}"`, before, req });
  bump('item.deleted', { itemId: before.id });
  res.json({ ok: true });
});

app.post('/api/admin/items/:id/variants', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const item = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const created = await prisma.variant.create({
    data: {
      menuItemId: item.id,
      name,
      priceDelta: Number(req.body.priceDelta) || 0,
      availability: req.body.availability === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK',
      sortOrder: Number(req.body.sortOrder) || 0,
    },
  });
  await audit({ admin: req.admin, action: 'CREATE', entityType: 'Variant', entityId: created.id, entityLabel: `${item.name} / ${created.name}`, summary: `${req.admin.name} added variant "${created.name}" to "${item.name}"`, after: created, req });
  bump('variant.created', { itemId: item.id, variantId: created.id });
  res.status(201).json({ variant: created });
});

app.patch('/api/admin/variants/:id', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  const data = {};
  for (const k of ['name', 'priceDelta', 'availability', 'sortOrder']) if (k in req.body) data[k] = req.body[k];
  const updated = await prisma.variant.update({ where: { id: before.id }, data });
  await audit({ admin: req.admin, action: 'UPDATE', entityType: 'Variant', entityId: updated.id, entityLabel: updated.name, summary: summarize(req.admin.name, `variant "${updated.name}"`, diff(before, updated, Object.keys(data))), before, after: updated, req });
  bump('variant.updated', { itemId: updated.menuItemId, variantId: updated.id });
  res.json({ variant: updated });
});

app.delete('/api/admin/variants/:id', auth, role('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  await prisma.variant.delete({ where: { id: before.id } });
  await audit({ admin: req.admin, action: 'DELETE', entityType: 'Variant', entityId: before.id, entityLabel: before.name, summary: `${req.admin.name} deleted variant "${before.name}"`, before, req });
  bump('variant.deleted', { itemId: before.menuItemId, variantId: before.id });
  res.json({ ok: true });
});

app.post('/api/admin/upload', auth, role('SUPER_ADMIN', 'MANAGER'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const imageUrl = `/uploads/${req.file.filename}`;
  await audit({ admin: req.admin, action: 'CREATE', entityType: 'Upload', entityId: req.file.filename, entityLabel: req.file.originalname, summary: `${req.admin.name} uploaded image ${req.file.originalname}`, after: { imageUrl, size: req.file.size }, req });
  res.status(201).json({ imageUrl });
});

// ——— Audit ———
app.get('/api/admin/audit', auth, role('SUPER_ADMIN'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const where = {};
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.entityType) where.entityType = String(req.query.entityType);
  if (req.query.adminId) where.adminId = String(req.query.adminId);
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ summary: { contains: q } }, { entityLabel: { contains: q } }, { adminEmail: { contains: q } }, { adminName: { contains: q } }];
  }
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  res.json({ logs, page, limit, total, pages: Math.ceil(total / limit) });
});

app.get('/api/admin/audit/:id', auth, role('SUPER_ADMIN'), async (req, res) => {
  const log = await prisma.auditLog.findUnique({ where: { id: req.params.id } });
  if (!log) return res.status(404).json({ error: 'Not found' });
  res.json({ log });
});

app.delete('/api/admin/audit', auth, role('SUPER_ADMIN'), async (req, res) => {
  const days = Number(req.query.olderThanDays);
  if (!days || days < 30) return res.status(400).json({ error: 'olderThanDays must be >= 30' });
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 864e5) } } });
  res.json({ deleted: result.count });
});

/** Restore menu from data.js when Render SQLite was wiped (only if empty, unless force=1). */
app.post('/api/admin/reseed', auth, role('SUPER_ADMIN'), async (req, res) => {
  const force = req.query.force === '1' || req.body?.force === true;
  const catCount = await prisma.category.count();
  if (catCount > 0 && !force) {
    return res.status(409).json({ error: 'Menu not empty', categories: catCount, hint: 'Pass force=1 to wipe & reseed' });
  }
  if (force && catCount > 0) {
    await prisma.menuItem.deleteMany({});
    await prisma.category.deleteMany({});
  }
  await seedMenuFromDataJs();
  const categories = await prisma.category.count();
  const items = await prisma.menuItem.count();
  await audit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'Menu',
    entityLabel: 'reseed',
    summary: `${req.admin.name} reseeded menu (${categories} cats / ${items} dishes)`,
    after: { categories, items, force },
    req,
  });
  bump('menu.reseeded', { categories, items });
  res.json({ ok: true, categories, items });
});

// ——— Guest visit analytics ———
const visitHits = new Map();
function allowVisitWrite(ip) {
  const now = Date.now();
  let row = visitHits.get(ip);
  if (!row || now > row.reset) row = { n: 0, reset: now + 60e3 };
  row.n += 1;
  visitHits.set(ip, row);
  return row.n <= 40;
}

app.post('/api/visits/start', async (req, res) => {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
  if (!allowVisitWrite(ip)) return res.status(429).json({ error: 'Too many requests' });
  const path = String(req.body?.path || '/').slice(0, 120);
  const choice = req.body?.choice != null ? String(req.body.choice).slice(0, 40) : null;
  const visit = await prisma.visit.create({
    data: {
      path,
      choice,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
    },
  });
  res.status(201).json({ id: visit.id });
});

app.post('/api/visits/ping', async (req, res) => {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
  if (!allowVisitWrite(ip)) return res.status(429).json({ error: 'Too many requests' });
  const id = String(req.body?.id || '');
  if (!id || id.length > 40) return res.status(400).json({ error: 'Invalid id' });
  const durationSec = Math.max(0, Math.min(86400, Math.floor(Number(req.body?.durationSec) || 0)));
  try {
    await prisma.visit.update({
      where: { id },
      data: { durationSec, lastSeenAt: new Date() },
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/api/admin/analytics', auth, role('SUPER_ADMIN'), async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
  const since = new Date(Date.now() - days * 864e5);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [visits, todayCount, allTime] = await Promise.all([
    prisma.visit.findMany({
      where: { startedAt: { gte: since } },
      select: { startedAt: true, durationSec: true, choice: true },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.visit.count({ where: { startedAt: { gte: dayStart } } }),
    prisma.visit.count(),
  ]);

  const byDayMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    byDayMap.set(d.toISOString().slice(0, 10), { day: d.toISOString().slice(0, 10), visits: 0, totalSec: 0 });
  }

  let totalSec = 0;
  let engaged = 0;
  let engagedSec = 0;
  const byChoice = {};

  for (const v of visits) {
    const key = v.startedAt.toISOString().slice(0, 10);
    const row = byDayMap.get(key);
    if (row) {
      row.visits += 1;
      row.totalSec += v.durationSec || 0;
    }
    totalSec += v.durationSec || 0;
    if ((v.durationSec || 0) >= 10) {
      engaged += 1;
      engagedSec += v.durationSec;
    }
    const c = v.choice || 'unknown';
    byChoice[c] = (byChoice[c] || 0) + 1;
  }

  const count = visits.length;
  res.json({
    days,
    today: todayCount,
    period: {
      visits: count,
      avgSec: count ? Math.round(totalSec / count) : 0,
      avgEngagedSec: engaged ? Math.round(engagedSec / engaged) : 0,
      engaged,
    },
    allTime,
    byDay: Array.from(byDayMap.values()).map((r) => ({
      day: r.day,
      visits: r.visits,
      avgSec: r.visits ? Math.round(r.totalSec / r.visits) : 0,
    })),
    byChoice,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (/CORS blocked/i.test(err.message)) return res.status(403).json({ error: 'CORS blocked' });
  if (/Only jpeg|Only images|File too large|Unexpected field/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Server error' });
});

io.on('connection', (s) => s.emit('menu:hello', { at: new Date().toISOString() }));

ensureDatabaseAndAdmin()
  .then(() => {
    server.listen(port, host, () => {
      console.log(`Friendly Menu API on http://127.0.0.1:${port}`);
    });
  })
  .catch((err) => {
    console.error('[setup] Failed to initialize database/admin:', err);
    process.exit(1);
  });
