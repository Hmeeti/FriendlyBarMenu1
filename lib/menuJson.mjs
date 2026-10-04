/**
 * Compact guest menu (menu.json) served from GitHub Pages.
 * Shared by the admin → GitHub sync (server) and scripts/build-menu-json.mjs.
 */

const NO_PHOTO = /(^|\/)nono\.png$/i;

function cleanImg(src) {
  const s = String(src || '').trim();
  if (!s || NO_PHOTO.test(s)) return undefined;
  return s.replace(/^\.\//, '');
}

function cleanText(value) {
  const s = String(value ?? '').trim();
  return s || undefined;
}

export function buildMenuJson(menu) {
  const sections = Array.isArray(menu?.sections) ? menu.sections : [];
  const items = menu?.items && typeof menu.items === 'object' ? menu.items : {};
  const details = menu?.details && typeof menu.details === 'object' ? menu.details : {};

  const out = sections.map((sec) => ({
    title: String(sec.title || ''),
    ...(sec.anchor ? { anchor: String(sec.anchor) } : {}),
    items: (sec.items || []).map((it) => {
      const key = String(it.id);
      const d = details[key] || {};
      const b = items[key] || {};
      const price = Number(it.price ?? b.price ?? d.price) || 0;
      const row = {
        id: it.id,
        name: String(it.name || b.name || d.name || ''),
        price,
      };
      const fullName = cleanText(d.name);
      if (fullName && fullName !== row.name) row.fullName = fullName;
      const desc = cleanText(it.desc ?? d.desc ?? b.desc);
      if (desc) row.desc = desc;
      const weight = cleanText(it.weight);
      if (weight) row.weight = weight;
      const img = cleanImg(it.img) || cleanImg(d.img) || cleanImg(b.img);
      if (img) row.img = img;
      if ((it.availability || b.availability) === 'OUT_OF_STOCK') row.oos = true;
      return row;
    }),
  }));

  return {
    v: 1,
    updatedAt: menu?.updatedAt || new Date().toISOString(),
    sections: out,
  };
}

export function menuJsonString(menu) {
  return `${JSON.stringify(buildMenuJson(menu))}\n`;
}
