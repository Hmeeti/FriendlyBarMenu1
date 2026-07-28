/**
 * Apply bar/drink price updates from owner list to data.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runInNewContext } from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '..', 'data.js');

const sandbox = { window: {}, console };
runInNewContext(fs.readFileSync(dataPath, 'utf8'), sandbox, { timeout: 30000 });

const sections = sandbox.window.MENU_SECTIONS;
const details = sandbox.window.ITEM_DETAILS || {};
const items = sandbox.window.MENU_ITEMS || {};

function setPrice(id, price, name) {
  const key = String(id);
  const ensure = (obj) => {
    if (!obj[key]) obj[key] = { name: name || '', price, img: 'image/nono.png', desc: '' };
    obj[key].price = price;
    if (name) obj[key].name = name;
  };
  ensure(details);
  ensure(items);
}

function findSection(title) {
  return sections.find((s) => s.title === title);
}

function patchItem(sectionTitle, matchName, { price, name, exact = false }) {
  const sec = findSection(sectionTitle);
  if (!sec) return console.warn('section missing:', sectionTitle);
  const item = sec.items.find((it) => {
    const n = it.name.toLowerCase();
    const m = matchName.toLowerCase();
    return exact ? n === m : n.includes(m);
  });
  if (!item) return console.warn('item missing:', sectionTitle, matchName);
  if (price != null) {
    item.price = price;
    item.priceDisplay = `${price}тг`;
    setPrice(item.id, price, name);
  }
  if (name) {
    item.name = name;
    setPrice(item.id, item.price, name);
  }
}

function patchAllInSection(sectionTitle, price) {
  const sec = findSection(sectionTitle);
  if (!sec) return;
  for (const it of sec.items) {
    it.price = price;
    it.priceDisplay = `${price}тг`;
    setPrice(it.id, price);
  }
}

// —— Чаи (new section) ——
const teaSection = {
  title: 'Чаи',
  anchor: null,
  items: [
    { id: 136, name: 'Ташкентский', price: 2000 },
    { id: 137, name: 'Ягодный', price: 2100 },
    { id: 138, name: 'Имбирь мед', price: 2100 },
    { id: 139, name: 'Малина мята', price: 2100 },
    { id: 140, name: 'Марокканский', price: 2100 },
    { id: 141, name: 'Облепиховый', price: 2100 },
  ].map((it) => ({
    ...it,
    weight: '',
    priceDisplay: `${it.price}тг`,
    img: null,
  })),
};
for (const it of teaSection.items) setPrice(it.id, it.price, it.name);
const teaIdx = sections.findIndex((s) => s.title === 'К чаю');
if (teaIdx >= 0 && !sections.some((s) => s.title === 'Чаи')) {
  sections.splice(teaIdx, 0, teaSection);
}

// —— К чаю ——
patchItem('К чаю', 'Лимон', { price: 800 });
patchItem('К чаю', 'Лайм', { price: 800 });
patchItem('К чаю', 'Мед', { price: 800 });
patchItem('К чаю', 'Молоко', { price: 800 });

// —— Лимонады / молочные / фреши ——
patchAllInSection('Лимонады', 2700);
patchAllInSection('Молочные коктели', 2100);
patchAllInSection('Фреш', 2500);

// —— Напитки ——
patchItem('Напитки', '0.25', { price: 900, name: 'Кола 0.25 стекло' });
patchItem('Напитки', 'Ріко', { price: 1800, name: 'Сок Piko в ассортименте' });
patchItem('Напитки', 'Borjomi', { price: 1400, name: 'Borjomi 0.5' });
patchItem('Напитки', 'rich', { price: 1200, name: 'Сок Rich' });
patchItem('Напитки', 'Red Bull', { price: 1200, name: 'Red Bull' });
patchItem('Напитки', 'Schweppes', { price: 1300, name: 'Schweppes 0.5' });
patchItem('Напитки', 'Turan', { price: 1000, name: 'Turan вода 0.5' });

const drinks = findSection('Напитки');
if (drinks) {
  drinks.items = drinks.items.filter(
    (it) => !/тассай/i.test(it.name)
  );
  const hasSamal1 = drinks.items.some((it) => /samal\/turan 1/i.test(it.name));
  if (!hasSamal1) {
    drinks.items.push(
      { id: 298, name: 'Samal/Turan 1л', weight: '', price: 900, priceDisplay: '900тг', img: null },
      { id: 299, name: 'Samal 0.5', weight: '', price: 1000, priceDisplay: '1000тг', img: null }
    );
    setPrice(298, 900, 'Samal/Turan 1л');
    setPrice(299, 1000, 'Samal 0.5');
  }
}

// —— Пиво ——
patchItem('Пиво разливное', 'Bud 0.5', { price: 1700, exact: true });
patchItem('Пиво разливное', 'Line', { price: 1600, name: 'Line brue 0.5' });
patchItem('Пиво разливное', 'Прага', { price: 1100 });
const draft = findSection('Пиво разливное');
if (draft && !draft.items.some((it) => /колба/i.test(it.name))) {
  draft.items.push({
    id: 300,
    name: 'Колба 3л',
    weight: '',
    price: 6200,
    priceDisplay: '6200тг',
    img: null,
  });
  setPrice(300, 6200, 'Колба 3л');
}

patchItem('Пиво бутылочное', 'Corona', { price: 2700, name: 'Corona Extra 0.33' });
patchItem('Пиво бутылочное', 'Guinness', { price: 3000, name: 'Guinness' });
patchItem('Пиво бутылочное', 'Bud', { price: 1900, exact: true });
patchItem('Пиво бутылочное', 'Tsingtao', { price: 1900, name: 'Tsingtao 0.33' });

// —— К пиву ——
patchItem('К пиву', 'Арахис', { price: 1000, exact: true });
patchItem('К пиву', 'Курт', { price: 900, exact: true });
patchItem('К пиву', 'Фисташки', { price: 1700, exact: true });
patchItem('К пиву', 'Чечил', { price: 1500, name: 'Чечил', exact: true });
patchItem('К пиву', 'Чипсы', { price: 1500, exact: true });
patchItem('К пиву', 'жарен', { price: 1500, name: 'Чечил жареный' });

// —— Алкоголь ——
patchItem('Ирландский виски', 'Jameson Original', { price: 2500, name: 'Jameson' });
patchItem('Ирландский виски', 'Jameson Black', { price: 2600, name: 'Jameson Black Barrel' });
patchItem('Купажированный виски', 'Chivas', { price: 3200, name: 'Chivas Regal 12' });
patchItem('Глинтвейн', 'Глинтвейн', { price: 2000, name: 'Глинтвейн' });
patchItem('Джин', 'Bombay', { price: 1900, name: 'Bombay' });
patchItem('Текила', 'Olmeca Blanco', { price: 2000, name: 'Olmeca Blanca' });
patchAllInSection('Настойки', 1000);
patchItem('Игристые вина', 'Martini Asti', { price: 15000, name: 'Martini Asti' });
patchItem('Игристые вина', 'Martini Brut', { price: 15000 });
patchItem('Игристые вина', 'Martini Prosecco', { price: 15000, name: 'Martini Prosecco' });
patchItem('Игристые вина', 'Абрау', { price: 10000, name: 'Абрау дюрсо' });
patchAllInSection('Домашнее грузиснкое вино по бокалам', 1700);

// strip weight (same as tail of data.js)
for (const sec of sections) {
  for (const it of sec.items || []) {
    if ('weight' in it) delete it.weight;
  }
}

const header = `/* Описания и уточнения картинок (из прежнего script.js) */
window.ITEM_DETAILS = ${JSON.stringify(details, null, 2)};

window.MENU_SECTIONS = ${JSON.stringify(sections, null, 2)};
// Удаляем поле \`weight\` со всех блюд (навигация/рендер будет работать без него)
if (window.MENU_SECTIONS && Array.isArray(window.MENU_SECTIONS)) {
  window.MENU_SECTIONS.forEach(function(section){
    if (section.items && Array.isArray(section.items)) {
      section.items.forEach(function(item){
        if (Object.prototype.hasOwnProperty.call(item, 'weight')) delete item.weight;
      });
    }
  });
}

window.MENU_ITEMS = ${JSON.stringify(items, null, 2)};
`;

fs.writeFileSync(dataPath, header, 'utf8');
console.log('Patched data.js — sections:', sections.length);
