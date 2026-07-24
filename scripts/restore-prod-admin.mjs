/**
 * One-shot: restore hmeeti admin + reseed empty Render menu from data.js
 * Usage: node scripts/restore-prod-admin.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runInNewContext } from 'vm';

const API = (process.env.FRIENDLY_API_BASE || 'https://friendlybarmenu1admin.onrender.com').replace(/\/$/, '');
const ADMIN_LOGIN = process.env.ADMIN_USERNAME || 'ilnur000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '9987650';
const OWNER_USER = (process.env.OWNER_USERNAME || 'hmeeti').toLowerCase();
const OWNER_PASS = process.env.OWNER_PASSWORD || '2289073';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'hmeeti@friendly.local';
const OWNER_NAME = process.env.OWNER_NAME || 'Hmeeti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function api(token, method, pathName, body) {
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${pathName} → ${res.status} ${data.error || res.statusText}`);
  return data;
}

function loadMenu() {
  const code = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  const sandbox = { window: {}, console };
  runInNewContext(code, sandbox, { timeout: 20000 });
  return {
    sections: sandbox.window.MENU_SECTIONS || [],
    details: sandbox.window.ITEM_DETAILS || {},
  };
}

async function main() {
  console.log('API:', API);
  const login = await api(null, 'POST', '/api/auth/login', {
    login: ADMIN_LOGIN,
    password: ADMIN_PASSWORD,
  });
  const token = login.token;
  if (!token) throw new Error('Login did not return token');
  console.log('Logged in as', login.user?.username);

  const { users } = await api(token, 'GET', '/api/auth/admins');
  const hasOwner = (users || []).some((u) => String(u.username).toLowerCase() === OWNER_USER);
  if (!hasOwner) {
    await api(token, 'POST', '/api/auth/admins', {
      username: OWNER_USER,
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      password: OWNER_PASS,
      role: 'SUPER_ADMIN',
    });
    console.log(`Created admin ${OWNER_USER}`);
  } else {
    console.log(`Admin ${OWNER_USER} already exists`);
  }

  const cats = await api(token, 'GET', '/api/admin/categories');
  if ((cats.categories || []).length > 0) {
    console.log(`Menu already has ${cats.categories.length} categories — skip seed`);
    return;
  }

  const { sections, details } = loadMenu();
  let items = 0;
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const title = sec.title || `Section ${i + 1}`;
    const created = await api(token, 'POST', '/api/admin/categories', {
      title,
      slug: `${sec.anchor || 'cat'}-${i}`,
      sortOrder: i,
      isActive: true,
    });
    const categoryId = created.category.id;
    for (let j = 0; j < (sec.items || []).length; j++) {
      const it = sec.items[j];
      const d = details[String(it.id)] || {};
      await api(token, 'POST', '/api/admin/items', {
        categoryId,
        legacyId: Number(it.id),
        name: it.name || d.name || `Item ${it.id}`,
        description: d.desc || it.desc || '',
        weight: it.weight || '',
        price: Number(it.price ?? d.price) || 0,
        imageUrl: it.img || d.img || 'image/nono.png',
        sortOrder: j,
        isActive: true,
      });
      items++;
    }
    console.log(`  + ${title} (${(sec.items || []).length})`);
  }
  console.log(`Seeded ${sections.length} categories / ${items} dishes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
