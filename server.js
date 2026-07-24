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

/** Ensure SQLite schema + default admin exist (safe after fresh git clone) */
async function ensureDatabaseAndAdmin() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log('[setup] Database missing or empty — running prisma db push…');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: __dirname });
  }

  const username = (process.env.ADMIN_USERNAME || 'ilnur000').toLowerCase();
  const email = (process.env.ADMIN_EMAIL || `${username}@friendly.local`).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '9987650';
  const name = process.env.ADMIN_NAME || 'Ilnur';
  const passwordHash = await bcrypt.hash(password, 12);

  let existing = null;
  try {
    existing =
      (await prisma.adminUser.findUnique({ where: { username } })) ||
      (await prisma.adminUser.findUnique({ where: { email } }));
  } catch {
    console.log('[setup] Tables missing — running prisma db push…');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: __dirname });
  }

  if (!existing) {
    existing =
      (await prisma.adminUser.findUnique({ where: { username } })) ||
      (await prisma.adminUser.findUnique({ where: { email } }));
  }

  if (!existing) {
    await prisma.adminUser.create({
      data: { username, email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
    });
    console.log(`[setup] Created default admin: ${username}`);
  } else {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: { username, email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
    });
  }

  if (!(process.env.JWT_SECRET || '').trim()) {
    throw new Error('JWT_SECRET is empty. Set it in .env (see .env.example).');
  }
}

const allow = (o) =>
  !o ||
  !origins.length ||
  origins.includes('*') ||
  origins.includes(o) ||
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o) ||
  /^https:\/\/([\w-]+\.)?github\.io$/i.test(o) ||
  /^https:\/\/friendlybarmenu1admin\.onrender\.com$/i.test(o);


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
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/image', express.static(path.join(__dirname, 'image')));

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, uploadDir),
    filename: (_r, f, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(f.originalname) || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => (f.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'))),
});

const itemInclude = {
  category: true,
  variants: { orderBy: { sortOrder: 'asc' } },
  modifiers: { include: { modifier: { include: { group: true } } } },
};

const slugify = (t) =>
  String(t).toLowerCase().replace(/[^a-z0-9а-яёәіңғүұқөһ\-]+/gi, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || `cat-${Date.now()}`;

const sign = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
const setCookie = (res, token) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 3600e3, path: '/' });
const readToken = (req) => req.cookies?.[COOKIE] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

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
app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
  if (!loginId || password.length < 6) return res.status(400).json({ error: 'Invalid credentials payload' });
  const user = await prisma.adminUser.findFirst({ where: { OR: [{ username: loginId }, { email: loginId }] } });
  if (!user?.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid login or password' });
  }
  const token = sign(user);
  setCookie(res, token);
  await audit({ admin: user, action: 'LOGIN', entityType: 'AdminUser', entityId: user.id, entityLabel: user.username || user.email, summary: `${user.name} logged in`, req });
  res.json({ user: publicUser(user), token });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await audit({ admin: req.admin, action: 'LOGOUT', entityType: 'AdminUser', entityId: req.admin.id, entityLabel: req.admin.email, summary: `${req.admin.name} logged out`, req });
  res.clearCookie(COOKIE, { path: '/' });
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
  const created = await prisma.menuItem.create({
    data: {
      legacyId: (agg._max.legacyId || 1000) + 1,
      categoryId,
      name,
      description: req.body.description ?? '',
      weight: req.body.weight ?? '',
      price: Number(price) || 0,
      imageUrl: req.body.imageUrl ?? 'image/nono.png',
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
app.get('/api/admin/audit', auth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const where = {};
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.entityType) where.entityType = String(req.query.entityType);
  if (req.query.adminId) where.adminId = String(req.query.adminId);
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ summary: { contains: q } }, { entityLabel: { contains: q } }, { adminEmail: { contains: q } }];
  }
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  res.json({ logs, page, limit, total, pages: Math.ceil(total / limit) });
});

app.get('/api/admin/audit/:id', auth, async (req, res) => {
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(/CORS blocked/i.test(err.message) ? 403 : 500).json({ error: err.message || 'Server error' });
});

io.on('connection', (s) => s.emit('menu:hello', { at: new Date().toISOString() }));

ensureDatabaseAndAdmin()
  .then(() => {
    server.listen(port, host, () => {
      console.log(`Friendly Menu API on http://127.0.0.1:${port}`);
      console.log(`Admin login: ${process.env.ADMIN_USERNAME || 'ilnur000'} / (see ADMIN_PASSWORD in .env)`);
    });
  })
  .catch((err) => {
    console.error('[setup] Failed to initialize database/admin:', err);
    process.exit(1);
  });
