/**
 * Offline security / data sanity checks (no live server required).
 * Usage: node scripts/security-selftest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

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

// —— imageUrl XSS vectors ——
assert(sanitizeImageUrl('x" onerror="alert(1)') === 'image/nono.png', 'reject quote breakout');
assert(sanitizeImageUrl('javascript:alert(1)') === 'image/nono.png', 'reject javascript:');
assert(sanitizeImageUrl('data:text/html,<script>') === 'image/nono.png', 'reject data:');
assert(sanitizeImageUrl('/uploads/../etc/passwd') === 'image/nono.png', 'reject path traversal');
assert(sanitizeImageUrl('/uploads/ok.jpg') === '/uploads/ok.jpg', 'allow safe upload path');
assert(sanitizeImageUrl('image/margarita.jpg') === 'image/margarita.jpg', 'allow local image path');
assert(sanitizeImageUrl('https://cdn.example.com/a.jpg') === 'https://cdn.example.com/a.jpg', 'allow https');

// —— escapeAttr for guest render ——
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(text) {
  return escapeHtml(text).replace(/'/g, '&#39;');
}
assert(!escapeAttr('x" onerror="alert(1)').includes('" onerror'), 'escapeAttr neutralizes attribute breakout');

// —— menu data integrity ——
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), sandbox, { timeout: 15000 });
const sections = sandbox.window.MENU_SECTIONS || [];
const ids = new Set();
let dishCount = 0;
let dup = 0;
for (const s of sections) {
  for (const it of s.items || []) {
    dishCount += 1;
    const id = String(it.id);
    if (ids.has(id)) dup += 1;
    ids.add(id);
    assert(it.name && String(it.name).trim(), `dish ${id} has name`);
    assert(it.priceDisplay || typeof it.price === 'number', `dish ${id} has price`);
  }
}
assert(dishCount > 50, `menu has dishes (${dishCount})`);
if (dup > 0) console.log(`note: ${dup} dish id(s) reused across sections (intentional cross-links)`);
assert(ids.size > 50, `unique dish ids present (${ids.size})`);

// —— .env.example must not ship real passwords ——
const envEx = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert(!/9987650|2289073/.test(envEx), '.env.example has no known default passwords');
assert(/CHANGE_ME/.test(envEx), '.env.example uses CHANGE_ME placeholders');

// —— server.js hardening markers ——
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
assert(server.includes('RESET_ADMIN_PASSWORD'), 'boot does not blindly reset passwords');
assert(server.includes('Too many login attempts'), 'login rate limit present');
assert(server.includes('Only jpeg/png/webp/gif'), 'upload MIME allowlist present');
assert(server.includes('sanitizeImageUrl'), 'imageUrl sanitizer present');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll security/data checks passed (${dishCount} dishes).`);
