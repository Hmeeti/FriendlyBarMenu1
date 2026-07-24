/**
 * One-shot: push static menu from data.js into Render (or any API).
 * Usage: node scripts/seed-render.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = (process.env.API_BASE || 'https://friendlybarmenu1admin.onrender.com').replace(/\/$/, '');
const USER = process.env.ADMIN_USERNAME || 'ilnur000';
const PASS = process.env.ADMIN_PASSWORD || '9987650';

function loadMenu() {
  const code = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 10000 });
  return {
    sections: sandbox.window.MENU_SECTIONS || [],
    details: sandbox.window.ITEM_DETAILS || {},
  };
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `cat-${Date.now()}`;
}

async function api(token, method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('API:', BASE);
  const { sections, details } = loadMenu();
  const dishCount = sections.reduce((n, s) => n + (s.items?.length || 0), 0);
  console.log(`Static menu: ${sections.length} sections, ${dishCount} dishes`);

  const health = await api(null, 'GET', '/api/health');
  console.log('health', health);

  const existing = await api(null, 'GET', '/api/menu');
  const existingCount = (existing.sections || []).reduce((n, s) => n + (s.items?.length || 0), 0);
  if (existingCount > 0) {
    console.log(`Remote already has ${existingCount} dishes — abort (set FORCE=1 to wipe via admin first)`);
    if (process.env.FORCE !== '1') process.exit(0);
  }

  const login = await api(null, 'POST', '/api/auth/login', { login: USER, password: PASS });
  const token = login.token;
  if (!token) throw new Error('No token from login');
  console.log('Logged in as', login.user?.username || USER);

  let createdCats = 0;
  let createdItems = 0;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const title = sec.title || `Section ${i + 1}`;
    const slug = sec.anchor || slugify(title) + (sec.anchor ? '' : `-${i}`);
    const cat = await api(token, 'POST', '/api/admin/categories', {
      title,
      slug: `${slug}-${i}`.replace(/--+/g, '-'),
      sortOrder: i,
      isActive: true,
    });
    createdCats++;
    const categoryId = cat.category.id;
    const items = sec.items || [];
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      const d = details[String(it.id)] || {};
      await api(token, 'POST', '/api/admin/items', {
        categoryId,
        legacyId: Number(it.id) || undefined,
        name: it.name || d.name || `Item ${it.id}`,
        price: it.price ?? d.price ?? 0,
        weight: it.weight || '',
        description: d.desc || it.desc || '',
        imageUrl: it.img || d.img || 'image/nono.png',
        sortOrder: j,
        isActive: true,
      });
      createdItems++;
      if (createdItems % 25 === 0) console.log(`… ${createdItems}/${dishCount} dishes`);
    }
  }

  const after = await api(null, 'GET', '/api/menu');
  const afterCount = (after.sections || []).reduce((n, s) => n + (s.items?.length || 0), 0);
  console.log(`Done. Created ${createdCats} categories, ${createdItems} items. API now has ${afterCount} dishes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
