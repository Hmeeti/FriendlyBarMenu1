/**
 * Build dish name translations (EN + KK) from data.js
 * Usage: node scripts/build-i18n-menu.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const code = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { timeout: 15000 });
const sections = sandbox.window.MENU_SECTIONS || [];
const details = sandbox.window.ITEM_DETAILS || {};

const phraseEn = [
  [/Хинкали из говядины/gi, 'Beef khinkali'],
  [/Хинкали с грибами/gi, 'Mushroom khinkali'],
  [/Салат по Имеретински/gi, 'Imeretian salad'],
  [/Салат по имеретински/gi, 'Imeretian salad'],
  [/Солянка по грузинский/gi, 'Georgian solyanka'],
  [/Харчо из говядины/gi, 'Beef kharcho'],
  [/Харчо из курицы/gi, 'Chicken kharcho'],
  [/Рамен кимчи с говядиной/gi, 'Kimchi ramen with beef'],
  [/Рамен кимчи с курицей/gi, 'Kimchi ramen with chicken'],
  [/Грибной по грузинский/gi, 'Georgian mushroom salad'],
  [/Салат Сулико/gi, 'Suliko salad'],
  [/Салат /gi, 'Salad '],
  [/Суп /gi, 'Soup '],
  [/из говядины/gi, 'with beef'],
  [/из курицы/gi, 'with chicken'],
  [/с грибами/gi, 'with mushrooms'],
  [/с сыром/gi, 'with cheese'],
  [/по грузинский/gi, 'Georgian-style'],
  [/по-грузински/gi, 'Georgian-style'],
  [/Чечевичный/gi, 'Lentil'],
  [/Лапша/gi, 'Noodle'],
  [/Домашнее/gi, 'Homemade'],
  [/грузиснкое/gi, 'Georgian'],
  [/грузинское/gi, 'Georgian'],
  [/вино по бокалам/gi, 'wine by the glass'],
  [/Красное полусадкое/gi, 'Red semi-sweet'],
  [/Красное полусладкое/gi, 'Red semi-sweet'],
  [/Белое полусладкое/gi, 'White semi-sweet'],
  [/полусадкое/gi, 'semi-sweet'],
  [/полусладкое/gi, 'semi-sweet'],
  [/Молочные коктели/gi, 'Milkshakes'],
  [/Безалкогольные коктейли/gi, 'Non-alcoholic cocktails'],
  [/Алкогольные коктейли/gi, 'Alcoholic cocktails'],
  [/Пиво разливное/gi, 'Draft beer'],
  [/Пиво бутылочное/gi, 'Bottled beer'],
  [/К пиву/gi, 'Beer snacks'],
  [/К чаю/gi, 'Tea pairings'],
  [/Добавки к кофе/gi, 'Coffee add-ons'],
  [/односолодовый шотландский виски/gi, 'Single malt Scotch whisky'],
  [/Купажированный виски/gi, 'Blended whisky'],
  [/Ирландский виски/gi, 'Irish whiskey'],
  [/Французский коньяк/gi, 'French cognac'],
  [/Армянский коньяк/gi, 'Armenian brandy'],
  [/Казахстанский бренди/gi, 'Kazakh brandy'],
  [/Американский бурбон/gi, 'American bourbon'],
  [/Игристые вина/gi, 'Sparkling wines'],
  [/Вино Италия/gi, 'Italian wine'],
  [/Вино Испания/gi, 'Spanish wine'],
  [/Вино Франция/gi, 'French wine'],
  [/Вино грузия/gi, 'Georgian wine'],
  [/Вино Чили/gi, 'Chilean wine'],
  [/Блюда из рыбы/gi, 'Fish dishes'],
  [/Блюда из курицы/gi, 'Chicken dishes'],
  [/Блюда на компанию/gi, 'Sharing plates'],
  [/Основные блюда/gi, 'Main courses'],
  [/Горячие закуски/gi, 'Hot appetizers'],
  [/Холодные закуски/gi, 'Cold appetizers'],
  [/Салаты Грузия/gi, 'Georgian salads'],
  [/Салаты Европа/gi, 'European salads'],
  [/Меню Грузия/gi, 'Georgian menu'],
  [/Меню Европа/gi, 'European menu'],
  [/Барное меню/gi, 'Bar menu'],
];

const phraseKk = [
  [/Хинкали из говядины/gi, 'Сиыр етінен хинкали'],
  [/Хинкали с грибами/gi, 'Саңырауқұлақты хинкали'],
  [/Салат по Имеретински/gi, 'Имеретин салаты'],
  [/Салат по имеретински/gi, 'Имеретин салаты'],
  [/Солянка по грузинский/gi, 'Грузин солянкасы'],
  [/Харчо из говядины/gi, 'Сиыр етінен харчо'],
  [/Харчо из курицы/gi, 'Тауық етінен харчо'],
  [/Рамен кимчи с говядиной/gi, 'Сиыр етімен кимчи рамен'],
  [/Рамен кимчи с курицей/gi, 'Тауық етімен кимчи рамен'],
  [/Грибной по грузинский/gi, 'Грузиндік саңырауқұлақ салаты'],
  [/Салат Сулико/gi, 'Сулико салаты'],
  [/Салат /gi, 'Салат '],
  [/Суп /gi, 'Сорпа '],
  [/из говядины/gi, 'сиыр етінен'],
  [/из курицы/gi, 'тауық етінен'],
  [/с грибами/gi, 'саңырауқұлақпен'],
  [/с сыром/gi, 'ірімшікпен'],
  [/по грузинский/gi, 'грузинше'],
  [/по-грузински/gi, 'грузинше'],
  [/Чечевичный/gi, 'Жасымық'],
  [/Лапша/gi, 'Кеспе'],
  [/Домашнее/gi, 'Үй'],
  [/грузиснкое/gi, 'грузин'],
  [/грузинское/gi, 'грузин'],
  [/вино по бокалам/gi, 'бокалмен шарап'],
  [/Красное полусадкое/gi, 'Қызыл жартылай тәтті'],
  [/Красное полусладкое/gi, 'Қызыл жартылай тәтті'],
  [/Белое полусладкое/gi, 'Ақ жартылай тәтті'],
  [/полусадкое/gi, 'жартылай тәтті'],
  [/полусладкое/gi, 'жартылай тәтті'],
];

const properEn = {
  'Мимино': 'Mimino',
  'Оджахури': 'Ojakhuri',
  'Ребра Батхани': 'Batkhani ribs',
  'Чахохбили': 'Chakhokhbili',
  'Чашошули': 'Chashushuli',
  'Шкмерули': 'Shkmeruli',
  'Глехури': 'Glekuri',
  'Бозбаш': 'Bozbash',
  'Том-ям': 'Tom yum',
  'Хачапури': 'Khachapuri',
  'Хинкали': 'Khinkali',
  'Аджарский': 'Adjarian',
  'Имеретинский': 'Imeretian',
  'Мегрельский': 'Megrelian',
  'Пенне': 'Penne',
  'Карбонара': 'Carbonara',
  'Болоньезе': 'Bolognese',
  'Цезарь': 'Caesar',
  'Греческий': 'Greek',
  'Маргарита': 'Margherita',
  'Пепперони': 'Pepperoni',
  'Четыре сыра': 'Four cheese',
  'Тирамису': 'Tiramisu',
  'Наполеон': 'Napoleon',
  'Чизкейк': 'Cheesecake',
  'Мохито': 'Mojito',
  'Апероль Шприц': 'Aperol Spritz',
  'Апероль шприц': 'Aperol Spritz',
};

const properKk = {
  'Мимино': 'Мимино',
  'Оджахури': 'Оджахури',
  'Ребра Батхани': 'Батхани қабырғалары',
  'Чахохбили': 'Чахохбили',
  'Чашошули': 'Чашошули',
  'Шкмерули': 'Шкмерули',
  'Глехури': 'Глехури',
  'Бозбаш': 'Бозбаш',
  'Том-ям': 'Том-ям',
  'Хачапури': 'Хачапури',
  'Хинкали': 'Хинкали',
  'Маргарита': 'Маргарита',
  'Пепперони': 'Пепперони',
  'Тирамису': 'Тирамису',
  'Мохито': 'Мохито',
};

function applyPhrases(name, phrases) {
  let out = name;
  for (const [re, to] of phrases) out = out.replace(re, to);
  return out.replace(/\s+/g, ' ').trim();
}

function translateName(name, lang) {
  if (lang === 'en' && properEn[name]) return properEn[name];
  if (lang === 'kk' && properKk[name]) return properKk[name];
  // try partial proper nouns
  let out = name;
  const proper = lang === 'en' ? properEn : properKk;
  for (const [from, to] of Object.entries(proper)) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  out = applyPhrases(out, lang === 'en' ? phraseEn : phraseKk);
  // If almost unchanged and still Cyrillic-heavy for EN, keep original (better than broken)
  if (lang === 'en' && /[а-яё]/i.test(out) && out === name) return name;
  return out;
}

function translateDesc(desc, lang) {
  if (!desc) return '';
  if (lang === 'en') {
    return applyPhrases(desc, [
      [/помидор(ы|ов)?/gi, 'tomato'],
      [/огурц(ы|ов)?/gi, 'cucumber'],
      [/сыр(а|ом)?/gi, 'cheese'],
      [/говядин(а|ы|ой)?/gi, 'beef'],
      [/курин(ое|ого|ым)?/gi, 'chicken'],
      [/курица/gi, 'chicken'],
      [/гриб(ы|ов|ами)?/gi, 'mushrooms'],
      [/специ(и|ями)/gi, 'spices'],
      [/соус/gi, 'sauce'],
      [/зелень/gi, 'herbs'],
      [/рис/gi, 'rice'],
      [/сметан(а|ы|ой)?/gi, 'sour cream'],
      [/майонез/gi, 'mayonnaise'],
    ]).replace(/\s+/g, ' ').trim();
  }
  return applyPhrases(desc, [
    [/помидор(ы|ов)?/gi, 'қызанақ'],
    [/огурц(ы|ов)?/gi, 'қияр'],
    [/сыр(а|ом)?/gi, 'ірімшік'],
    [/говядин(а|ы|ой)?/gi, 'сиыр еті'],
    [/курин(ое|ого|ым)? филе/gi, 'тауық филесі'],
    [/курица/gi, 'тауық'],
    [/гриб(ы|ов|ами)?/gi, 'саңырауқұлақ'],
    [/специ(и|ями)/gi, 'дәмдеуіш'],
    [/соус/gi, 'соус'],
    [/зелень/gi, 'көк'],
    [/рис/gi, 'күріш'],
    [/сметан(а|ы|ой)?/gi, 'қаймақ'],
  ]).replace(/\s+/g, ' ').trim();
}

const items = {};
for (const sec of sections) {
  for (const it of sec.items || []) {
    const id = String(it.id);
    const d = details[id] || {};
    const name = it.name || d.name || '';
    const desc = d.desc || it.desc || '';
    items[id] = {
      en: translateName(name, 'en'),
      kk: translateName(name, 'kk'),
      // Keep original Russian descriptions — phrase replace is too noisy for recipes
      enDesc: desc,
      kkDesc: desc,
    };
  }
}

const out = `/* Auto-generated dish translations — run: node scripts/build-i18n-menu.mjs */
window.FRIENDLY_MENU_I18N = ${JSON.stringify(items, null, 2)};
`;
fs.writeFileSync(path.join(root, 'i18n-menu.js'), out);
console.log('Wrote i18n-menu.js with', Object.keys(items).length, 'items');
