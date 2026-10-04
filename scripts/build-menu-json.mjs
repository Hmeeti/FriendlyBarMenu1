/**
 * Regenerate menu.json (what the guest page loads) from data.js.
 *   node scripts/build-menu-json.mjs
 * The admin panel's GitHub sync writes menu.json itself; run this after editing data.js by hand
 * or via scripts/patch-*.mjs.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { menuJsonString } from '../lib/menuJson.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), sandbox, { timeout: 15000 });
const w = sandbox.window;

let updatedAt;
try {
  updatedAt = JSON.parse(fs.readFileSync(path.join(root, 'data/menu-export.json'), 'utf8')).updatedAt;
} catch {}

const json = menuJsonString({
  sections: w.MENU_SECTIONS,
  items: w.MENU_ITEMS,
  details: w.ITEM_DETAILS,
  updatedAt: updatedAt || '1970-01-01T00:00:00.000Z',
});
fs.writeFileSync(path.join(root, 'menu.json'), json, 'utf8');
const parsed = JSON.parse(json);
const count = parsed.sections.reduce((n, s) => n + s.items.length, 0);
console.log(`menu.json: ${parsed.sections.length} sections, ${count} items, ${Math.round(json.length / 1024)} KB`);
