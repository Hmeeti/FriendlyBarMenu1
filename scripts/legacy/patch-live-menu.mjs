import fs from 'fs';

const p = 'js/script.js';
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('function renderMenuItemCard(it)');
const end = s.indexOf('function onMenuRootClick', start);
if (start < 0 || end < 0) {
  console.error('markers missing', start, end);
  process.exit(1);
}

const newCard = `function renderMenuItemCard(it) {
    const id = it.id;
    const name = escapeHtml(it.name);
    const priceDisp = escapeHtml(it.priceDisplay || '');
    const out = it.availability === 'OUT_OF_STOCK';
    const imgPath = it.img ? imgSrcForPage(it.img) : '';
    const imgBlock = imgPath
        ? \`<div class="item-image-wrap"><img src="\${imgPath}" alt="" class="item-image" loading="lazy" width="400" height="280" decoding="async"></div>\`
        : '';
    const itemClass = (imgPath ? 'menu-item' : 'menu-item menu-item--no-image') + (out ? ' menu-item--oos' : '');
    const addBtn = out
        ? \`<span class="badge badge--oos">нет в наличии</span>\`
        : \`<button type="button" class="add-btn" data-add="\${id}" aria-label="Добавить в заказ">+</button>\`;
    return \`
        <div class="\${itemClass}" data-item-id="\${id}" role="button" tabindex="0">
            \${imgBlock}
            <div class="item-content">
                <div class="item-name">\${name}</div>
                <div class="item-footer">
                    <div class="item-price">\${priceDisp}</div>
                    \${addBtn}
                </div>
            </div>
        </div>\`;
}

`;

s = s.slice(0, start) + newCard + s.slice(end);

s = s.replace(
  `const id = Number(idStr);
        const b = base[idStr];`,
  `const id = Number.isFinite(Number(idStr)) && String(Number(idStr)) === String(idStr) ? Number(idStr) : idStr;
        const b = base[idStr];`
);

const hook = `
window.FriendlyMenu = {
    applyLiveMenu(payload) {
        if (!payload) return;
        if (payload.sections) window.MENU_SECTIONS = payload.sections;
        if (payload.items) window.MENU_ITEMS = payload.items;
        if (payload.details) window.ITEM_DETAILS = Object.assign({}, window.ITEM_DETAILS || {}, payload.details);
        items = buildItemsCatalog();
        renderMenu();
        updateCart();
    },
    reload() {
        items = buildItemsCatalog();
        renderMenu();
    }
};

`;

if (!s.includes('window.FriendlyMenu')) {
  s = s.replace('function closePopup(choice)', hook + 'function closePopup(choice)');
}

// Make cart lookups tolerant of string ids from API
s = s.replace(
  'const id = Number(itemId);\n    const item = items[id];',
  'const id = Number.isFinite(Number(itemId)) && String(Number(itemId)) === String(itemId) ? Number(itemId) : itemId;\n    const item = items[id];'
);

fs.writeFileSync(p, s, 'utf8');
console.log('patched script.js');
