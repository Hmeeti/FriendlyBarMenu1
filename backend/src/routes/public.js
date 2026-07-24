import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

/** Public menu payload shaped for the existing Friendly menu frontend */
router.get('/menu', async (_req, res) => {
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
      variants: item.variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceDelta: v.priceDelta,
        availability: v.availability,
      })),
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
  for (const section of sections) {
    for (const item of section.items) {
      const key = String(item.id);
      items[key] = {
        name: item.name,
        price: item.price,
        img: item.img,
        desc: item.desc,
        availability: item.availability,
      };
      details[key] = {
        name: item.name,
        price: item.price,
        img: item.img,
        desc: item.desc,
      };
    }
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    updatedAt: new Date().toISOString(),
    sections,
    items,
    details,
  });
});

router.get('/health', (_req, res) => res.json({ ok: true }));

export default router;
