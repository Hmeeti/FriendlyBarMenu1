/**
 * Guest menu i18n: ru | kk | en
 */
(function () {
  const KEY = 'fm_lang';
  const SUPPORTED = ['ru', 'kk', 'en'];

  const UI = {
    ru: {
      'doc.title': 'Friendly — Меню',
      'search.placeholder': 'Поиск блюда…',
      'search.aria': 'Поиск по меню',
      'cart.btn': 'Заказ',
      'cart.aria': 'Список заказа',
      'cart.title': 'Ваш заказ',
      'cart.close': 'Закрыть корзину',
      'cart.empty': 'Добавьте блюда кнопкой «+»',
      'cart.subtotal': 'Сумма позиций',
      'cart.service': 'Обслуживание 15%',
      'cart.total': 'Итого к оплате',
      'nav.all': 'Все',
      'nav.aria': 'Категории меню',
      'admin.title': 'Админ-панель',
      'welcome.eyebrow': 'Friendly Bar',
      'welcome.title': 'Добро пожаловать',
      'welcome.service': 'Обслуживание в заведении — <strong>15%</strong>.',
      'welcome.karaoke': 'Караоке — <strong>1 000 тг</strong> с гостя.',
      'welcome.subtitle': 'Выберите меню',
      'welcome.kitchen': 'Кухня и бар',
      'welcome.kitchenDesc': 'Блюда, напитки, десерты',
      'welcome.notice': 'Продолжая, вы принимаете правила заведения.',
      'modal.close': 'Закрыть',
      'modal.fallbackDesc': 'Состав уточняйте у персонала.',
      'oos': 'нет в наличии',
      'add': 'Добавить в заказ',
      'theme.light': 'Светлая тема',
      'theme.dark': 'Тёмная тема',
      'top': 'Наверх',
      'footer.alert': 'Обращаем ваше внимание: обслуживание — <strong>15%</strong>. Стоимость караоке — <strong>1 000 тг</strong> с человека.',
      'footer.protect': 'Сайт полностью защищен безопасным соединением.',
      'footer.developer': 'Разработчик сайта — hmeeti',
      'footer.copy': '© 2026 Все права защищены. Копирование материалов запрещено.',
      'footer.rulesTitle': 'Правила посещения заведения',
      'footer.rules': 'В заведении запрещено курение и распитие принесённых с собой напитков. Алкогольная и табачная продукция, а также обслуживание в баре не предоставляются гостям младше <strong>21 года</strong>. Администрация вправе отказать в обслуживании гостям в состоянии сильного алкогольного опьянения или при нарушении общественного порядка. Просим уважать покой других гостей и персонала. Книга жалоб и предложений предоставляется по первому требованию. Заведение не несёт ответственности за личные вещи, оставленные без присмотра.',
      'lang.label': 'Язык',
    },
    kk: {
      'doc.title': 'Friendly — Мәзір',
      'search.placeholder': 'Тағам іздеу…',
      'search.aria': 'Мәзір бойынша іздеу',
      'cart.btn': 'Тапсырыс',
      'cart.aria': 'Тапсырыс тізімі',
      'cart.title': 'Сіздің тапсырысыңыз',
      'cart.close': 'Себетті жабу',
      'cart.empty': '«+» батырмасымен тағам қосыңыз',
      'cart.subtotal': 'Тағамдар сомасы',
      'cart.service': 'Қызмет көрсету 15%',
      'cart.total': 'Төлеуге барлығы',
      'nav.all': 'Барлығы',
      'nav.aria': 'Мәзір санаттары',
      'admin.title': 'Админ панелі',
      'welcome.eyebrow': 'Friendly Bar',
      'welcome.title': 'Қош келдіңіз',
      'welcome.service': 'Мекемеде қызмет көрсету — <strong>15%</strong>.',
      'welcome.karaoke': 'Караоке — бір қонаққа <strong>1 000 тг</strong>.',
      'welcome.subtitle': 'Мәзірді таңдаңыз',
      'welcome.kitchen': 'Ас үй және бар',
      'welcome.kitchenDesc': 'Тағамдар, сусындар, десерттер',
      'welcome.notice': 'Жалғастыра отырып, мекеме ережелерін қабылдайсыз.',
      'modal.close': 'Жабу',
      'modal.fallbackDesc': 'Құрамын қызметкерлерден нақтылаңыз.',
      'oos': 'қолда жоқ',
      'add': 'Тапсырысқа қосу',
      'theme.light': 'Жарық тема',
      'theme.dark': 'Қараңғы тема',
      'top': 'Жоғары',
      'footer.alert': 'Назар аударыңыз: қызмет көрсету — <strong>15%</strong>. Караоке құны — бір адамға <strong>1 000 тг</strong>.',
      'footer.protect': 'Сайт қауіпсіз байланыспен толық қорғалған.',
      'footer.developer': 'Сайт әзірлеушісі — hmeeti',
      'footer.copy': '© 2026 Барлық құқықтар қорғалған. Материалдарды көшіруге тыйым салынады.',
      'footer.rulesTitle': 'Мекемеге келу ережелері',
      'footer.rules': 'Мекемеде темекі шегуге және өзімен алып келген сусындарды ішуге тыйым салынады. Алкоголь мен темекі өнімдері, сондай-ақ барда қызмет көрсету <strong>21 жасқа</strong> толмаған қонақтарға берілмейді. Әкімшілік қатты мас күйдегі немесе қоғамдық тәртіпті бұзған қонақтарға қызмет көрсетуден бас тарту құқығын өзінде қалдырады. Басқа қонақтар мен қызметкерлердің тыныштығын құрметтеуіңізді сұраймыз. Шағымдар мен ұсыныстар кітабы бірінші талап бойынша беріледі. Мекеме қараусыз қалдырылған жеке заттар үшін жауапкершілік көтермейді.',
      'lang.label': 'Тіл',
    },
    en: {
      'doc.title': 'Friendly — Menu',
      'search.placeholder': 'Search dishes…',
      'search.aria': 'Search the menu',
      'cart.btn': 'Order',
      'cart.aria': 'Your order',
      'cart.title': 'Your order',
      'cart.close': 'Close cart',
      'cart.empty': 'Add dishes with the “+” button',
      'cart.subtotal': 'Items subtotal',
      'cart.service': 'Service 15%',
      'cart.total': 'Total due',
      'nav.all': 'All',
      'nav.aria': 'Menu categories',
      'admin.title': 'Admin panel',
      'welcome.eyebrow': 'Friendly Bar',
      'welcome.title': 'Welcome',
      'welcome.service': 'Service charge is <strong>15%</strong>.',
      'welcome.karaoke': 'Karaoke — <strong>1,000 ₸</strong> per guest.',
      'welcome.subtitle': 'Choose a menu',
      'welcome.kitchen': 'Kitchen & bar',
      'welcome.kitchenDesc': 'Dishes, drinks, desserts',
      'welcome.notice': 'By continuing, you accept the venue rules.',
      'modal.close': 'Close',
      'modal.fallbackDesc': 'Ask staff for ingredients.',
      'oos': 'sold out',
      'add': 'Add to order',
      'theme.light': 'Light theme',
      'theme.dark': 'Dark theme',
      'top': 'Back to top',
      'footer.alert': 'Please note: service charge is <strong>15%</strong>. Karaoke is <strong>1,000 ₸</strong> per person.',
      'footer.protect': 'This site is protected by a secure connection.',
      'footer.developer': 'Website developer — hmeeti',
      'footer.copy': '© 2026 All rights reserved. Copying materials is prohibited.',
      'footer.rulesTitle': 'House rules',
      'footer.rules': 'Smoking and consuming your own beverages on the premises is prohibited. Alcohol, tobacco products and bar service are not provided to guests under <strong>21 years old</strong>. Management reserves the right to refuse service to guests who are heavily intoxicated or disrupt public order. Please respect the peace of other guests and staff. A complaints and suggestions book is provided upon request. The venue is not responsible for personal belongings left unattended.',
      'lang.label': 'Language',
    },
  };

  const SECTIONS = {
    kk: {
      'Меню Грузия': 'Грузия мәзірі',
      'Основные блюда': 'Негізгі тағамдар',
      'Салаты Грузия': 'Грузин салаттары',
      'Супы': 'Сорпалар',
      'Хачапури': 'Хачапури',
      'Горячие закуски': 'Ыстық тәбетжатар',
      'Холодные закуски': 'Суық тәбетжатар',
      'Меню Европа': 'Еуропа мәзірі',
      'Салаты Европа': 'Еуропа салаттары',
      'Стейки': 'Стейктер',
      'Блюда из рыбы': 'Балық тағамдары',
      'Блюда из курицы': 'Тауық тағамдары',
      'Блюда на компанию': 'Компанияға арналған',
      'Пасты': 'Пасталар',
      'Роллы': 'Роллдар',
      'Сеты': 'Сеттер',
      'Пиццы': 'Пиццалар',
      'Шашлыки': 'Кәуаптар',
      'Гарниры': 'Гарнирлер',
      'Соусы': 'Соустар',
      'Десерты': 'Десерттер',
      'К чаю': 'Шайға',
      'Ice coffee': 'Ice coffee',
      'Добавки к кофе': 'Кофе қоспалары',
      'Лимонады': 'Лимонадтар',
      'Молочные коктели': 'Сүт коктейльдері',
      'Безалкогольные коктейли': 'Алкогольсіз коктейльдер',
      'Фреш': 'Фреш',
      'Напитки': 'Сусындар',
      'Пиво разливное': 'Құйма сыра',
      'Пиво бутылочное': 'Бөтелке сыра',
      'К пиву': 'Сыраға',
      'Водка': 'Арақ',
      'Односолодовый шотландский виски': 'Бір сабанды шотланд вискиі',
      'Купажированный виски': 'Купажды виски',
      'Ирландский виски': 'Ирланд вискиі',
      'Французский коньяк': 'Француз коньягы',
      'Армянский коньяк': 'Армян коньягы',
      'Казахстанский бренди': 'Қазақстан брендиі',
      'Глинтвейн': 'Глинтвейн',
      'Алкогольные коктейли': 'Алкогольді коктейльдер',
      'Джин': 'Джин',
      'Ликер': 'Ликер',
      'Настойки': 'Тұнбалар',
      'Ром': 'Ром',
      'Американский бурбон': 'Америкалық бурбон',
      'Текила': 'Текила',
      'Вермуты': 'Вермуттар',
      'Игристые вина': 'Көпіршікті шараптар',
      'Вино Италия': 'Италия шарабы',
      'Вино Испания': 'Испания шарабы',
      'Вино Франция': 'Франция шарабы',
      'Вино грузия': 'Грузия шарабы',
      'Вино Чили': 'Чили шарабы',
      'Домашнее грузиснкое вино по бокалам': 'Үй грузин шарабы (бокал)',
      'Барное меню': 'Бар мәзірі',
    },
    en: {
      'Меню Грузия': 'Georgian menu',
      'Основные блюда': 'Main courses',
      'Салаты Грузия': 'Georgian salads',
      'Супы': 'Soups',
      'Хачапури': 'Khachapuri',
      'Горячие закуски': 'Hot appetizers',
      'Холодные закуски': 'Cold appetizers',
      'Меню Европа': 'European menu',
      'Салаты Европа': 'European salads',
      'Стейки': 'Steaks',
      'Блюда из рыбы': 'Fish dishes',
      'Блюда из курицы': 'Chicken dishes',
      'Блюда на компанию': 'Sharing plates',
      'Пасты': 'Pasta',
      'Роллы': 'Rolls',
      'Сеты': 'Sets',
      'Пиццы': 'Pizzas',
      'Шашлыки': 'Shashlik',
      'Гарниры': 'Sides',
      'Соусы': 'Sauces',
      'Десерты': 'Desserts',
      'К чаю': 'Tea pairings',
      'Ice coffee': 'Ice coffee',
      'Добавки к кофе': 'Coffee add-ons',
      'Лимонады': 'Lemonades',
      'Молочные коктели': 'Milkshakes',
      'Безалкогольные коктейли': 'Non-alcoholic cocktails',
      'Фреш': 'Fresh juices',
      'Напитки': 'Drinks',
      'Пиво разливное': 'Draft beer',
      'Пиво бутылочное': 'Bottled beer',
      'К пиву': 'Beer snacks',
      'Водка': 'Vodka',
      'Односолодовый шотландский виски': 'Single malt Scotch whisky',
      'Купажированный виски': 'Blended whisky',
      'Ирландский виски': 'Irish whiskey',
      'Французский коньяк': 'French cognac',
      'Армянский коньяк': 'Armenian brandy',
      'Казахстанский бренди': 'Kazakh brandy',
      'Глинтвейн': 'Mulled wine',
      'Алкогольные коктейли': 'Cocktails',
      'Джин': 'Gin',
      'Ликер': 'Liqueur',
      'Настойки': 'Infusions',
      'Ром': 'Rum',
      'Американский бурбон': 'American bourbon',
      'Текила': 'Tequila',
      'Вермуты': 'Vermouth',
      'Игристые вина': 'Sparkling wines',
      'Вино Италия': 'Italian wine',
      'Вино Испания': 'Spanish wine',
      'Вино Франция': 'French wine',
      'Вино грузия': 'Georgian wine',
      'Вино Чили': 'Chilean wine',
      'Домашнее грузиснкое вино по бокалам': 'Homemade Georgian wine (glass)',
      'Барное меню': 'Bar menu',
    },
  };

  function normalizeLang(lang) {
    const l = String(lang || '').toLowerCase();
    if (l === 'kz' || l === 'kk' || l === 'kaz') return 'kk';
    if (l === 'en' || l === 'eng') return 'en';
    return 'ru';
  }

  function getLang() {
    try {
      return normalizeLang(localStorage.getItem(KEY) || document.documentElement.lang || 'ru');
    } catch (_) {
      return 'ru';
    }
  }

  function setLang(lang) {
    const next = normalizeLang(lang);
    try {
      localStorage.setItem(KEY, next);
    } catch (_) {}
    document.documentElement.lang = next === 'kk' ? 'kk' : next;
    document.documentElement.setAttribute('data-lang', next);
    window.dispatchEvent(new CustomEvent('friendly:lang', { detail: { lang: next } }));
    return next;
  }

  function t(key) {
    const lang = getLang();
    return (UI[lang] && UI[lang][key]) || (UI.ru && UI.ru[key]) || key;
  }

  function translateSection(title) {
    const lang = getLang();
    if (lang === 'ru' || !title) return title;
    return (SECTIONS[lang] && SECTIONS[lang][title]) || title;
  }

  function translateItemName(id, fallback) {
    const lang = getLang();
    if (lang === 'ru') return fallback;
    const table = window.FRIENDLY_MENU_I18N || {};
    const byName = window.FRIENDLY_MENU_I18N_BY_NAME || {};
    const row = table[String(id)] || (fallback ? byName[fallback] : null);
    if (!row) return fallback;
    return row[lang] || fallback;
  }

  function translateItemDesc(id, fallback) {
    const lang = getLang();
    if (lang === 'ru') return fallback;
    const table = window.FRIENDLY_MENU_I18N || {};
    const byName = window.FRIENDLY_MENU_I18N_BY_NAME || {};
    const row = table[String(id)] || (fallback ? byName[fallback] : null);
    if (!row) return fallback;
    const key = lang === 'en' ? 'enDesc' : 'kkDesc';
    return row[key] || fallback;
  }

  function applyStatic() {
    document.title = t('doc.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = t(key);
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
      else el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.querySelectorAll('[data-i18n-section]').forEach((el) => {
      const ru = el.getAttribute('data-i18n-section');
      el.textContent = translateSection(ru);
    });
    document.querySelectorAll('.lang-switch__btn').forEach((btn) => {
      const active = btn.getAttribute('data-lang') === getLang();
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  window.FriendlyI18n = {
    SUPPORTED,
    getLang,
    setLang,
    t,
    translateSection,
    translateItemName,
    translateItemDesc,
    applyStatic,
  };

  // initial
  setLang(getLang());
})();
