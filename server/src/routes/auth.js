import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
} from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  login: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(6),
}).refine((d) => d.login || d.username || d.email, { message: 'login required' });

async function findAdminByLogin(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  return prisma.adminUser.findFirst({
    where: {
      OR: [
        { username: lower },
        { email: lower },
      ],
    },
  });
}

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials payload' });

  const loginId = parsed.data.login || parsed.data.username || parsed.data.email;
  const user = await findAdminByLogin(loginId);
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid login or password' });

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid login or password' });

  const token = signToken(user);
  setAuthCookie(res, token);
  await writeAudit({
    admin: user,
    action: 'LOGIN',
    entityType: 'AdminUser',
    entityId: user.id,
    entityLabel: user.username || user.email,
    summary: `${user.name} logged in`,
    req,
  });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  await writeAudit({
    admin: req.admin,
    action: 'LOGOUT',
    entityType: 'AdminUser',
    entityId: req.admin.id,
    entityLabel: req.admin.email,
    summary: `${req.admin.name} logged out`,
    req,
  });
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.admin.id,
      username: req.admin.username,
      email: req.admin.email,
      name: req.admin.name,
      role: req.admin.role,
    },
  });
});

const createAdminSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(7),
  role: z.enum(['SUPER_ADMIN', 'MANAGER']).default('MANAGER'),
});

router.post('/admins', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const parsed = createAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await prisma.adminUser.create({
    data: {
      username: parsed.data.username.toLowerCase(),
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
  });

  await writeAudit({
    admin: req.admin,
    action: 'CREATE',
    entityType: 'AdminUser',
    entityId: created.id,
    entityLabel: created.username,
    summary: `${req.admin.name} created admin ${created.username} (${created.role})`,
    after: { username: created.username, email: created.email, name: created.name, role: created.role },
    req,
  });

  res.status(201).json({
    user: {
      id: created.id,
      username: created.username,
      email: created.email,
      name: created.name,
      role: created.role,
    },
  });
});

router.get('/admins', requireAuth, requireRole('SUPER_ADMIN'), async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});

export default router;
