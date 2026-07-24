import { prisma } from './prisma.js';

export async function writeAudit({
  admin,
  action,
  entityType,
  entityId = null,
  entityLabel = '',
  summary,
  before = null,
  after = null,
  req = null,
}) {
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

/** Shallow field diff for audit summaries */
export function diffFields(before, after, fields) {
  const changes = [];
  for (const key of fields) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ field: key, from: a ?? null, to: b ?? null });
    }
  }
  return changes;
}

export function summarizeUpdate(adminName, entityLabel, changes) {
  if (!changes.length) return `${adminName} updated ${entityLabel} (no field changes)`;
  const parts = changes.map((c) => {
    if (c.field === 'price') return `price from ${c.from} to ${c.to}`;
    return `${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`;
  });
  return `${adminName} updated ${entityLabel}: ${parts.join('; ')}`;
}
