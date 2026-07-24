import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const where = {};
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.entityType) where.entityType = String(req.query.entityType);
  if (req.query.adminId) where.adminId = String(req.query.adminId);
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [
      { summary: { contains: q } },
      { entityLabel: { contains: q } },
      { adminEmail: { contains: q } },
    ];
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ logs, page, limit, total, pages: Math.ceil(total / limit) });
});

router.get('/:id', async (req, res) => {
  const log = await prisma.auditLog.findUnique({ where: { id: req.params.id } });
  if (!log) return res.status(404).json({ error: 'Not found' });
  res.json({ log });
});

router.delete('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  // optional retention cleanup
  const days = Number(req.query.olderThanDays);
  if (!days || days < 30) return res.status(400).json({ error: 'olderThanDays must be >= 30' });
  const cutoff = new Date(Date.now() - days * 86400000);
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  res.json({ deleted: result.count });
});

export default router;
