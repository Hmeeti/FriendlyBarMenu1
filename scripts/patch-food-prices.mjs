/**
 * Apply food menu price updates from owner list to data.js
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

function nextId() {
  const used = new Set();
  for (const k of Object.keys(details)) used.add(Number(k));
  for (const k of Object.keys(items)) used.add(Number(k));
  for (const sec of sections) {
    for (const it of sec.items || []) used.add(Number(it.id));
  }
  let id = 301;
  while (used.has(id)) id++;
  return id;
}

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
  if (!sec) {
    console.warn('section missing:', sectionTitle);
    return false;
  }
  const item = sec.items.find((it) => {
    const n = it.name.toLowerCase();
    const m = matchName.toLowerCase();
    return exact ? n === m : n.includes(m);
  });
  if (!item) {
    console.warn('item missing:', sectionTitle, matchName);
    return false;
  }
  if (price != null) {
    item.price = price;
    item.priceDisplay = `${price}тг`;
    setPrice(item.id, price, name || item.name);
  }
  if (name) {
    item.name = name;
    setPrice(item.id, item.price, name);
  }
  console.log(`  ✓ ${sectionTitle}: ${item.name} → ${item.price}`);
  return true;
}

function addItem(sectionTitle, { name, price, img = 'image/nono.png', desc = '' }) {
  const sec = findSection(sectionTitle);
  if (!sec) {
    console.warn('section missing for add:', sectionTitle);
    return;
  }
  const exists = sec.items.find((it) => it.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    exists.price = price;
    exists.priceDisplay = `${price}тг`;
    setPrice(exists.id, price, name);
    console.log(`  ~ ${sectionTitle}: ${name} → ${price} (already existed)`);
    return;
  }
  const id = nextId();
  sec.items.push({
    id,
    name,
    price,
    priceDisplay: `${price}тг`,
    img: img === 'image/nono.png' ? null : img,
  });
  details[String(id)] = { name, price, img, desc };
  items[String(id)] = { name, price, img, desc };
  console.log(`  + ${sectionTitle}: ${name} → ${price} (id=${id})`);
}

console.log('Updating food prices…');

// —— Салаты Европа ——
patchItem('Салаты Европа', 'Пивные креветки', { price: 4390 }); // may be in hot apps
patchItem('Горячие закуски', 'Пивные креветки', { price: 4390 });
patchItem('Салаты Европа', 'Греческий', { price: 2790 });
patchItem('Салаты Европа', 'Хрустящие баклажаны', { price: 2890 });
patchItem('Салаты Европа', 'Цезарь с креветками', { price: 3490 });
patchItem('Салаты Европа', 'Цезарь с семгой', { price: 3390 });
patchItem('Салаты Европа', 'Цезарь с курицей', { price: 3190 });
patchItem('Салаты Европа', 'Острый гурман', { price: 3090 });
patchItem('Салаты Европа', 'Тифлис', { price: 3590 });
patchItem('Салаты Европа', 'Friendly', { price: 4490 });
patchItem('Салаты Европа', 'Буратта', { price: 3590 });
patchItem('Салаты Европа', 'Фреш', { price: 2790 });

// —— Салаты Грузия ——
patchItem('Салаты Грузия', 'Имеретински', { price: 2890 });
patchItem('Салаты Грузия', 'Глехури', { price: 2490 });
patchItem('Салаты Грузия', 'Грибной', { price: 3790 });
patchItem('Салаты Грузия', 'Сулико', { price: 3890 });

// —— Супы ——
patchItem('Супы', 'Чечевич', { price: 2290 });
patchItem('Супы', 'Том-ям', { price: 4490 });
patchItem('Супы', 'Том ям', { price: 4490 });
patchItem('Супы', 'Бозбаш', { price: 4390 });
patchItem('Супы', 'Солянка', { price: 3690 });
patchItem('Супы', 'Харчо из говядины', { price: 2790 });
patchItem('Супы', 'Харчо из курицы', { price: 2690 });
patchItem('Супы', 'Лапша', { price: 1890 });
patchItem('Супы', 'Рамен кимчи с говядиной', { price: 3190 });
patchItem('Супы', 'Рамен кимчи с курицей', { price: 3190 });
patchItem('Супы', 'Шорпа', { price: 2890 });
patchItem('Супы', 'Пельмени', { price: 2890 });

// —— Горячие / холодные закуски ——
patchItem('Горячие закуски', 'Гарлики', { price: 1190 });
patchItem('Горячие закуски', 'Бараньи семечки', { price: 2890 });
patchItem('Горячие закуски', 'Сырные палочки', { price: 2490 });
patchItem('Горячие закуски', 'Бадриджани', { price: 2790 });
patchItem('Горячие закуски', 'Баклажан мефурат', { price: 3390 });
patchItem('Горячие закуски', 'кеци', { price: 3190, name: 'Грибы на кеци' });
patchItem('Холодные закуски', 'Русская', { price: 4190 });
patchItem('Холодные закуски', 'Кавказ', { price: 4590, exact: true });
patchItem('Холодные закуски', 'Соленья', { price: 4790 });
patchItem('К пиву', 'Чечил жареный', { price: 1790 });
patchItem('К пиву', 'жарен', { price: 1790 });

// —— Рыба / основные ——
patchItem('Блюда из рыбы', 'Форель', { price: 5490 });
patchItem('Блюда из рыбы', 'кат', { price: 5890 });
patchItem('Основные блюда', 'Хинкали из говядины', { price: 3590 });
patchItem('Основные блюда', 'Хинкали с грибами', { price: 3590 });
patchItem('Основные блюда', 'Мимино', { price: 4890 });
patchItem('Основные блюда', 'Оджахури', { price: 4590 });
patchItem('Основные блюда', 'Батхани', { price: 5390 });
patchItem('Основные блюда', 'Чахохбили', { price: 3990 });
patchItem('Основные блюда', 'Чашошули', { price: 4590 });
patchItem('Основные блюда', 'Шкмерули', { price: 4790 });
addItem('Основные блюда', { name: 'Мясо по аджарски', price: 4890 });
addItem('Основные блюда', { name: 'Тевзи мефурат', price: 5290 });

// —— Хачапури ——
patchItem('Хачапури', 'мегрельски', { price: 3590 });
patchItem('Хачапури', 'аджарски', { price: 3590 });
patchItem('Хачапури', 'имеретински', { price: 3590 });
patchItem('Хачапури', 'королевски', { price: 4190 });
patchItem('Хачапури', 'Хычины с сыром', { price: 1690, exact: true });
patchItem('Хачапури', 'Хычины с сыром и зеленью', { price: 1790, exact: true });
// duplicate хычины in Пиццы section
patchItem('Пиццы', 'Хычины с сыром', { price: 1690, exact: true });
patchItem('Пиццы', 'Хычины с сыром и зеленью', { price: 1790, exact: true });

// —— Пиццы ——
patchItem('Пиццы', '4 сезона', { price: 3490 });
patchItem('Пиццы', 'Болоньезе', { price: 3190 });
patchItem('Пиццы', 'Курица с грибами', { price: 3190 });
patchItem('Пиццы', 'Маргарита', { price: 2890 });
patchItem('Пиццы', 'Пеперони', { price: 3190 });
patchItem('Пиццы', 'лососем', { price: 3590 });

// —— Пасты ——
patchItem('Пасты', 'Альфредо', { price: 3790 });
patchItem('Пасты', 'Болоньезе', { price: 3690 });
patchItem('Пасты', 'морепродуктами', { price: 3590 });

// —— Роллы ——
patchItem('Роллы', 'Филадельфия', { price: 3490 });
patchItem('Роллы', 'Калифорния', { price: 3390, exact: true });
patchItem('Роллы', 'Дракон', { price: 3590 });
patchItem('Роллы', 'Чиз Эби', { price: 3290 });
patchItem('Роллы', 'Бонито', { price: 3190 });
patchItem('Роллы', 'Лас-Вегас', { price: 3590 });
patchItem('Роллы', 'Цезарь темпура', { price: 3490 });
addItem('Роллы', { name: 'Запеченный лосось', price: 3290 });
addItem('Роллы', { name: 'Запеченный угорь', price: 3390 });
addItem('Роллы', { name: 'Фукуока ролл', price: 3390 });
addItem('Роллы', { name: 'Окаяма ролл', price: 3390 });
addItem('Роллы', { name: 'Френдли ролл', price: 3990 });

// —— Стейки / курица ——
patchItem('Стейки', 'Рибай', { price: 6490 });
patchItem('Стейки', 'Тибон', { price: 6990 });
patchItem('Стейки', 'Медальоны', { price: 6890 });
patchItem('Стейки', 'Оссобук', { price: 5890 });
patchItem('Стейки', 'Стриплойн', { price: 6090 });
patchItem('Блюда из курицы', 'терияки', { price: 4290 });
patchItem('Блюда из курицы', 'блю', { price: 4590 });

// —— Шашлыки ——
patchItem('Шашлыки', 'Мякоть', { price: 3690 });
patchItem('Шашлыки', 'Кавказский', { price: 4190 });
patchItem('Шашлыки', 'Антрекот', { price: 3990 });
patchItem('Шашлыки', 'Крылышки', { price: 2590, exact: true });
patchItem('Шашлыки', 'филе', { price: 2790 });
patchItem('Шашлыки', 'Люля', { price: 2790 });
patchItem('Шашлыки', 'Семечки', { price: 2290, exact: true });
patchItem('Шашлыки', 'Овощи на гриле', { price: 1990 });
patchItem('Шашлыки', 'Шампиньоны', { price: 2290 });

// —— Гарниры ——
patchItem('Гарниры', 'Пюре', { price: 890 });
patchItem('Гарниры', 'Фри', { price: 1190, exact: true });
patchItem('Гарниры', 'дольки', { price: 1190 });
patchItem('Гарниры', 'домашнему', { price: 1190 });
patchItem('Гарниры', 'Рис', { price: 990, exact: true });
patchItem('Гарниры', 'Овощи на гриле', { price: 1990 });

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
