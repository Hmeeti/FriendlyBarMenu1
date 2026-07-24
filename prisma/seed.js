import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function slugify(title, fallback) {
  const s = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9а-яёәіңғүұқөһ\-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
  return s || fallback;
}

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'ilnur000').toLowerCase();
  const email = (process.env.ADMIN_EMAIL || `${username}@friendly.local`).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '9987650';
  const name = process.env.ADMIN_NAME || 'Ilnur';

  const passwordHash = await bcrypt.hash(password, 12);
  const existing =
    (await prisma.adminUser.findUnique({ where: { username } })) ||
    (await prisma.adminUser.findUnique({ where: { email } }));

  if (existing) {
    const data = { username, email, name, role: 'SUPER_ADMIN', isActive: true };
    if (process.env.RESET_ADMIN_PASSWORD === '1') data.passwordHash = passwordHash;
    await prisma.adminUser.update({ where: { id: existing.id }, data });
  } else {
    await prisma.adminUser.create({
      data: { username, email, name, passwordHash, role: 'SUPER_ADMIN' },
    });
  }
  console.log(`Admin ready: ${username} / ${email}`);

  const exportPath = path.resolve(__dirname, '../data/menu-export.json');
  if (!fs.existsSync(exportPath)) {
    console.log('No menu-export.json — skip menu seed');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const details = raw.details || {};
  let sortCat = 0;

  for (const section of raw.sections || []) {
    if (!section.items?.length && !section.title) continue;
    const baseSlug = section.anchor || slugify(section.title, `cat-${sortCat}`);
    let slug = baseSlug;
    let n = 1;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${n++}`;
    }

    const existing = await prisma.category.findFirst({ where: { title: section.title } });
    const category =
      existing ||
      (await prisma.category.create({
        data: {
          title: section.title,
          slug,
          sortOrder: sortCat,
          isActive: true,
        },
      }));

    let sortItem = 0;
    for (const item of section.items || []) {
      const det = details[String(item.id)] || {};
      const data = {
        legacyId: item.id,
        categoryId: category.id,
        name: det.name || item.name,
        description: det.desc || item.desc || '',
        weight: item.weight || '',
        price: Number(item.price) || 0,
        imageUrl: det.img || item.img || 'image/nono.png',
        availability: 'IN_STOCK',
        isActive: true,
        sortOrder: sortItem++,
      };

      await prisma.menuItem.upsert({
        where: { legacyId: item.id },
        update: data,
        create: data,
      });
    }
    sortCat += 1;
  }

  const counts = {
    categories: await prisma.category.count(),
    items: await prisma.menuItem.count(),
  };
  console.log('Seeded menu', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
