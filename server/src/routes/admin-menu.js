import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAudit, diffFields, summarizeUpdate } from '../lib/audit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);

const itemInclude = {
  category: true,
  variants: { orderBy: { sortOrder: 'asc' } },
  modifiers: { include: { modifier: { include: { group: true } } } },
};

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9а-яёәіңғүұқөһ\-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || `cat-${Date.now()}`;
}

// ——— Categories ———
router.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: { _count: { select: { items: true } } },
  });
  res.json({ categories });
});

const categorySchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.post('/categories', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const slug = parsed.data.slug || slugify(parsed.data.title);
  const created = await prisma.category.create({
    data: {
      title: parsed.data.title,
      slug,
      sortOrder: parsed.data.sortOrder ?? 0,
      isActive: parsed.data.isActive ?? true,
    },
  });

  await writeAudit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'Category',
    entityId: created.id,
    entityLabel: created.title,
    summary: `${req.admin.name} created category "${created.title}"`,
    after: created,
    req,
  });
  req.app.locals.realtime.menuChanged('category.created', { categoryId: created.id });
  res.status(201).json({ category: created });
});

router.patch('/categories/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });

  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.category.update({
    where: { id: before.id },
    data: parsed.data,
  });

  const changes = diffFields(before, updated, ['title', 'slug', 'sortOrder', 'isActive']);
  await writeAudit({
    admin: req.admin,
    action: 'UPDATE',
    entityType: 'Category',
    entityId: updated.id,
    entityLabel: updated.title,
    summary: summarizeUpdate(req.admin.name, `category "${updated.title}"`, changes),
    before,
    after: updated,
    req,
  });
  req.app.locals.realtime.menuChanged('category.updated', { categoryId: updated.id });
  res.json({ category: updated });
});

router.delete('/categories/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });

  await prisma.category.delete({ where: { id: before.id } });
  await writeAudit({
    admin: req.admin,
    action: 'DELETE',
    entityType: 'Category',
    entityId: before.id,
    entityLabel: before.title,
    summary: `${req.admin.name} deleted category "${before.title}"`,
    before,
    req,
  });
  req.app.locals.realtime.menuChanged('category.deleted', { categoryId: before.id });
  res.json({ ok: true });
});

// ——— Menu items ———
router.get('/items', async (req, res) => {
  const where = {};
  if (req.query.categoryId) where.categoryId = String(req.query.categoryId);
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ name: { contains: q } }, { description: { contains: q } }];
  }
  const items = await prisma.menuItem.findMany({
    where,
    include: itemInclude,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json({ items });
});

router.get('/items/:id', async (req, res) => {
  const item = await prisma.menuItem.findUnique({
    where: { id: req.params.id },
    include: itemInclude,
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ item });
});

const itemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  weight: z.string().optional(),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK']).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.post('/items', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const agg = await prisma.menuItem.aggregate({ _max: { legacyId: true } });
  const legacyId = (agg._max.legacyId || 1000) + 1;

  const created = await prisma.menuItem.create({
    data: {
      legacyId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      weight: parsed.data.weight ?? '',
      price: parsed.data.price,
      imageUrl: parsed.data.imageUrl ?? 'image/nono.png',
      availability: parsed.data.availability ?? 'IN_STOCK',
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
    include: itemInclude,
  });

  await writeAudit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'MenuItem',
    entityId: created.id,
    entityLabel: created.name,
    summary: `${req.admin.name} created dish "${created.name}" at ${created.price}`,
    after: created,
    req,
  });
  req.app.locals.realtime.menuChanged('item.created', { itemId: created.id });
  res.status(201).json({ item: created });
});

router.patch('/items/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });

  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.menuItem.update({
    where: { id: before.id },
    data: parsed.data,
    include: itemInclude,
  });

  const changes = diffFields(before, updated, [
    'name', 'description', 'weight', 'price', 'imageUrl',
    'availability', 'isActive', 'sortOrder', 'categoryId',
  ]);
  await writeAudit({
    admin: req.admin,
    action: 'UPDATE',
    entityType: 'MenuItem',
    entityId: updated.id,
    entityLabel: updated.name,
    summary: summarizeUpdate(req.admin.name, `dish "${updated.name}"`, changes),
    before,
    after: updated,
    req,
  });
  req.app.locals.realtime.menuChanged('item.updated', { itemId: updated.id });
  res.json({ item: updated });
});

router.delete('/items/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  const before = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });

  await prisma.menuItem.delete({ where: { id: before.id } });
  await writeAudit({
    admin: req.admin,
    action: 'DELETE',
    entityType: 'MenuItem',
    entityId: before.id,
    entityLabel: before.name,
    summary: `${req.admin.name} deleted dish "${before.name}"`,
    before,
    req,
  });
  req.app.locals.realtime.menuChanged('item.deleted', { itemId: before.id });
  res.json({ ok: true });
});

// ——— Variants ———
const variantSchema = z.object({
  name: z.string().min(1),
  priceDelta: z.number().int().optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK']).optional(),
  sortOrder: z.number().int().optional(),
});

router.post('/items/:id/variants', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const item = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const created = await prisma.variant.create({
    data: {
      menuItemId: item.id,
      name: parsed.data.name,
      priceDelta: parsed.data.priceDelta ?? 0,
      availability: parsed.data.availability ?? 'IN_STOCK',
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  await writeAudit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'Variant',
    entityId: created.id,
    entityLabel: `${item.name} / ${created.name}`,
    summary: `${req.admin.name} added variant "${created.name}" to "${item.name}"`,
    after: created,
    req,
  });
  req.app.locals.realtime.menuChanged('variant.created', { itemId: item.id, variantId: created.id });
  res.status(201).json({ variant: created });
});

router.patch('/variants/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  const parsed = variantSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.variant.update({ where: { id: before.id }, data: parsed.data });
  await writeAudit({
    admin: req.admin,
    action: 'UPDATE',
    entityType: 'Variant',
    entityId: updated.id,
    entityLabel: updated.name,
    summary: summarizeUpdate(req.admin.name, `variant "${updated.name}"`, diffFields(before, updated, ['name', 'priceDelta', 'availability', 'sortOrder'])),
    before,
    after: updated,
    req,
  });
  req.app.locals.realtime.menuChanged('variant.updated', { itemId: updated.menuItemId, variantId: updated.id });
  res.json({ variant: updated });
});

router.delete('/variants/:id', requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const before = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Not found' });
  await prisma.variant.delete({ where: { id: before.id } });
  await writeAudit({
    admin: req.admin,
    action: 'DELETE',
    entityType: 'Variant',
    entityId: before.id,
    entityLabel: before.name,
    summary: `${req.admin.name} deleted variant "${before.name}"`,
    before,
    req,
  });
  req.app.locals.realtime.menuChanged('variant.deleted', { itemId: before.menuItemId, variantId: before.id });
  res.json({ ok: true });
});

// ——— Image upload ———
router.post('/upload', requireRole('SUPER_ADMIN', 'MANAGER'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const imageUrl = `/uploads/${req.file.filename}`;
  await writeAudit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'Upload',
    entityId: req.file.filename,
    entityLabel: req.file.originalname,
    summary: `${req.admin.name} uploaded image ${req.file.originalname}`,
    after: { imageUrl, size: req.file.size },
    req,
  });
  res.status(201).json({ imageUrl });
});

export default router;
