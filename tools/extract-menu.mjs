import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const htmlPath = path.join(root, 'index.html');
const itemDetailsExistingPath = path.join(root, 'js', 'item-details.js');
const scriptPath = path.join(root, 'js', 'script.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const detailSrc = fs.existsSync(itemDetailsExistingPath)
    ? fs.readFileSync(itemDetailsExistingPath, 'utf8')
    : fs.readFileSync(scriptPath, 'utf8');

function parseItemBlock(block) {
    const modalM = block.match(/onclick="openModal\((\d+)\)"/);
    if (!modalM) return null;
    const id = Number(modalM[1]);
    const nameM = block.match(/<div class="item-name">([^<]+)<\/div>/);
    const name = nameM ? nameM[1].trim() : 'Без названия';
    const weightM = block.match(/<div class="item-weight">([^<]+)<\/div>/);
    const weight = weightM ? weightM[1].trim() : '';
    const priceM = block.match(/<div class="item-price">([^<]+)<\/div>/);
    const priceDisplay = priceM ? priceM[1].trim() : '';
    const digits = priceDisplay.replace(/\D/g, '');
    const price = digits ? parseInt(digits, 10) : 0;
    let img = null;
    const imgM =
        block.match(/src="\.\/([^"]+)"[^>]*class="item-image"/) ||
        block.match(/class="item-image"[^>]*src="\.\/([^"]+)"/) ||
        block.match(/src="\.\/([^"]+)"/);
    if (imgM) {
        img = imgM[1].replace(/^\.\//, '').replace(/\\/g, '/');
        while (img.includes('/./')) img = img.replace('/./', '/');
        img = img.replace(/\/{2,}/g, '/');
        img = img.replace(/^image\/image\//i, 'image/');
        if (!/^image\//i.test(img)) {
            img = 'image/' + img.replace(/^\/+/, '');
        }
    }
    return { id, name, weight, price, priceDisplay, img };
}

function splitMenuItemBlocks(slice) {
    const blocks = [];
    let i = 0;
    while (true) {
        const start = slice.indexOf('<div class="menu-item"', i);
        if (start === -1) break;
        const next = slice.indexOf('<div class="menu-item"', start + 20);
        const end = next === -1 ? slice.length : next;
        blocks.push(slice.slice(start, end));
        i = end;
    }
    return blocks;
}

function extractItemDetailsFromScript(src) {
    const details = {};
    const re =
        /(\d+):\s*\{\s*name:\s*'((?:\\'|[^'])*)',\s*price:\s*(\d+),\s*img:\s*'((?:\\'|[^'])*)',\s*desc:\s*'((?:\\'|[^'])*)'\s*\}\s*,?/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        details[m[1]] = {
            name: m[2].replace(/\\'/g, "'"),
            price: Number(m[3]),
            img: m[4].replace(/\\'/g, "'"),
            desc: m[5].replace(/\\'/g, "'")
        };
    }
    return details;
}

function extractItemDetails(source) {
    const jsonMatch = source.match(/window\.ITEM_DETAILS\s*=\s*(\{[\s\S]*?\});/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (_) {
            /* fall through */
        }
    }
    return extractItemDetailsFromScript(source);
}

const h2Regex = /<h2 class="title__menu"([^>]*)>([^<]+)<\/h2>/g;
const sections = [];
let m;
while ((m = h2Regex.exec(html)) !== null) {
    const attrs = m[1];
    const title = m[2].trim();
    const idMatch = attrs.match(/id="([^"]+)"/);
    const anchor = idMatch ? idMatch[1] : null;
    sections.push({
        index: m.index,
        endHeader: m.index + m[0].length,
        title,
        anchor
    });
}

const cartIdx = html.indexOf('<div class="cart-panel"');
const MENU_SECTIONS = [];

for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const nextIdx = sections[i + 1] ? sections[i + 1].index : cartIdx;
    const slice = html.slice(sec.endHeader, nextIdx);
    const blocks = splitMenuItemBlocks(slice);
    const items = blocks.map(parseItemBlock).filter(Boolean);
    MENU_SECTIONS.push({
        title: sec.title,
        anchor: sec.anchor,
        items
    });
}

const MENU_ITEMS = {};
for (const sec of MENU_SECTIONS) {
    for (const it of sec.items) {
        if (!MENU_ITEMS[it.id]) {
            MENU_ITEMS[it.id] = {
                name: it.name,
                price: it.price,
                img: it.img || 'image/nono.png',
                desc: ''
            };
        }
    }
}

const ITEM_DETAILS = extractItemDetails(detailSrc);

const itemCount = MENU_SECTIONS.reduce((a, s) => a + s.items.length, 0);
if (itemCount === 0) {
    console.error(
        'extract-menu: в index.html не найдено карточек меню. Восстановите полный HTML или не запускайте скрипт на упрощённой версии.'
    );
    process.exit(1);
}

const menuDataPath = path.join(root, 'js', 'menu-data.js');
const itemDetailsPath = path.join(root, 'js', 'item-details.js');

const menuDataContent = `/* Авто-сгенерировано tools/extract-menu.mjs — не править руками */
window.MENU_SECTIONS = ${JSON.stringify(MENU_SECTIONS, null, 2)};
window.MENU_ITEMS = ${JSON.stringify(MENU_ITEMS, null, 2)};
`;

const itemDetailsContent = `/* Описания и уточнения картинок (из прежнего script.js) */
window.ITEM_DETAILS = ${JSON.stringify(ITEM_DETAILS, null, 2)};
`;

fs.writeFileSync(menuDataPath, menuDataContent, 'utf8');
fs.writeFileSync(itemDetailsPath, itemDetailsContent, 'utf8');

console.log('Wrote', menuDataPath);
console.log('Wrote', itemDetailsPath);
console.log('Sections:', MENU_SECTIONS.length, 'item blocks total:', MENU_SECTIONS.reduce((a, s) => a + s.items.length, 0));
