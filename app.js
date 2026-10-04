(function () {
  'use strict';

  const SERVICE_RATE = 0.15;
  const MENU_URL = 'menu.json';
  const MENU_CACHE_KEY = 'fm_menu_v2';
  const CART_KEY = 'fm_cart_v1';
  const CART_TTL_MS = 12 * 3600e3;
  const WELCOME_KEY = 'fm_welcome_v2';
  const TABLE_KEY = 'fm_table';
  const API_BASE = 'https://friendlybarmenu1admin.onrender.com';
  const EAGER_IMAGES = 3;
  const REFRESH_AFTER_MS = 60e3;
  const NO_PHOTO = /(^|\/)nono\.png$/i;
  const PHOTO_EXT = /\.(png|jpe?g|webp)$/i;
  const CARD_SIZES = '(min-width: 1100px) 280px, (min-width: 600px) 31vw, 47vw';
  const DISH_SIZES = '(min-width: 768px) 480px, 100vw';

  const SECTION_NAV_IDS = {
    'Меню Грузия': 'menu-gruziya',
    'Основные блюда': 'main-courses',
    'Салаты Грузия': 'salaty-gruziya',
    'Супы': 'soup',
    'Хачапури': 'khachapuri',
    'Горячие закуски': 'goryachie-zakuski',
    'Холодные закуски': 'holodnye-zakuski',
    'Меню Европа': 'menu-evropa',
    'Салаты Европа': 'salaty-evropa',
    'Стейки': 'beef',
    'Блюда из рыбы': 'fisheat',
    'Блюда из курицы': 'chikenaet',
    'Блюда на компанию': 'alleat',
    'Пасты': 'pasties',
    'Роллы': 'rolls',
    'Сеты': 'sets',
    'Пиццы': 'pizza',
    'Шашлыки': 'meat',
    'Гарниры': 'garnirs',
    'Соусы': 'souls',
    'Десерты': 'candy',
  };
  const HERO_TITLES = new Set(['Меню Грузия', 'Меню Европа']);
  const BAR_START = new Set(['Чаи', 'К чаю']);
  const BAR = { id: 'bar', title: 'Барное меню' };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const wideQuery = window.matchMedia ? window.matchMedia('(min-width: 768px)') : { matches: false };
  const reducedMotion = () => motionQuery.matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nf = new Intl.NumberFormat('ru-RU');
  const money = (n) => `${nf.format(Math.round(n))} тг`;

  const state = {
    menu: null,
    menuText: '',
    items: new Map(),
    cards: new Map(),
    searchIndex: [],
    cart: [],
    table: '',
    dishId: null,
    loading: false,
    lastFetch: 0,
  };

  const dom = {};

  /* ---------- i18n ---------- */

  const api = () => window.FriendlyI18n || null;
  function t(key, fallback) {
    const i = api();
    if (!i) return fallback || key;
    const v = i.t(key);
    return v && v !== key ? v : fallback || key;
  }
  const lang = () => (api() ? api().getLang() : 'ru');
  const trSection = (title) => (api() ? api().translateSection(title) : title);
  const trName = (item) => (api() ? api().translateItemName(item.id, item.name) : item.name);
  const trFullName = (item) => {
    const full = item.fullName || item.name;
    return api() ? api().translateItemName(item.id, full) : full;
  };
  const trDesc = (item) => (api() ? api().translateItemDesc(item.id, item.desc || '') : item.desc || '');
  const countLabel = (n) => (api() ? api().countItems(n) : String(n));

  /* ---------- images ---------- */

  function cleanPath(src) {
    return String(src || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  }

  function hasPhoto(src) {
    const p = cleanPath(src);
    return Boolean(p) && !NO_PHOTO.test(p);
  }

  function originalSrc(src) {
    const p = cleanPath(src);
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/uploads/')) return API_BASE + p;
    const rel = p.replace(/^\/+/, '').replace(/^image\/image\//i, 'image/');
    return /^image\//i.test(rel) ? rel : `image/${rel}`;
  }

  function optimizedSrc(src, size) {
    const p = originalSrc(src);
    if (!/^image\//i.test(p) || /^image\/opt\//i.test(p) || !PHOTO_EXT.test(p)) return '';
    return p.replace(/^image\//i, 'image/opt/').replace(PHOTO_EXT, `-${size}.webp`);
  }

  function setImage(img, src, sizes, large) {
    const small = optimizedSrc(src, 400);
    img.dataset.orig = originalSrc(src);
    delete img.dataset.failed;
    img.classList.remove('is-loaded');
    if (small) {
      const big = optimizedSrc(src, 800);
      img.sizes = sizes;
      img.srcset = `${small} 400w, ${big} 800w`;
      img.src = large ? big : small;
    } else {
      img.removeAttribute('srcset');
      img.src = img.dataset.orig;
    }
  }

  function onImageError(e) {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.orig) return;
    if (!img.dataset.failed && img.getAttribute('src') !== img.dataset.orig) {
      img.dataset.failed = '1';
      img.removeAttribute('srcset');
      img.src = img.dataset.orig;
      return;
    }
    const media = img.parentElement;
    if (!media) return;
    if (media.id === 'dishMedia') {
      media.hidden = true;
      return;
    }
    const card = media.closest('.card');
    media.remove();
    if (card) card.classList.add('card--text');
  }

  function onImageLoad(e) {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('is-loaded');
  }

  /* ---------- DOM helpers ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function slugify(title) {
    return String(title)
      .toLowerCase()
      .replace(/[^a-zа-яёәіңғүұқөһ0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '');
  }

  function sectionId(section) {
    const title = String(section.title || '').trim();
    if (SECTION_NAV_IDS[title]) return SECTION_NAV_IDS[title];
    const known = new Set(Object.values(SECTION_NAV_IDS));
    const raw = String(section.anchor || '').trim();
    if (raw) {
      const stripped = raw.replace(/(-\d+)+$/g, '');
      if (known.has(stripped)) return stripped;
      return stripped || raw;
    }
    return slugify(title) || 'section';
  }

  function uniqueId(id, used) {
    let out = id;
    let n = 2;
    while (used.has(out)) out = `${id}-${n++}`;
    used.add(out);
    return out;
  }

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function searchText(item) {
    const parts = [item.name, item.fullName, item.desc, item.section, trSection(item.section)];
    if (lang() !== 'ru') parts.push(trName(item), trFullName(item), trDesc(item));
    return normalize(parts.filter(Boolean).join(' '));
  }

  /* ---------- menu rendering ---------- */

  function renderHero(title, id) {
    const wrap = el('section', 'hero');
    wrap.id = id;
    wrap.dataset.nav = id;
    const h = el('h2', 'hero__title', trSection(title));
    h.dataset.i18nSection = title;
    wrap.appendChild(h);
    return wrap;
  }

  function renderAddControl(item) {
    if (item.oos) {
      const badge = el('span', 'oos', t('oos', 'нет в наличии'));
      badge.dataset.i18n = 'oos';
      return badge;
    }
    const btn = el('button', 'add');
    btn.type = 'button';
    btn.dataset.action = 'add';
    btn.setAttribute('aria-label', `${t('add', 'Добавить в заказ')}: ${trName(item)}`);
    const qty = el('span', 'add__qty');
    qty.hidden = true;
    qty.setAttribute('aria-hidden', 'true');
    btn.appendChild(qty);
    return btn;
  }

  function renderNameButton(item) {
    const h = el('h3', 'card__name');
    const btn = el('button', 'card__open', trName(item));
    btn.type = 'button';
    btn.dataset.action = 'open';
    btn.setAttribute('aria-haspopup', 'dialog');
    h.appendChild(btn);
    return h;
  }

  function renderCard(item, photoIndex) {
    const card = el('li', `card${item.oos ? ' card--oos' : ''}`);
    card.dataset.id = String(item.id);
    if (hasPhoto(item.img)) {
      const media = el('div', 'card__media');
      const img = document.createElement('img');
      img.alt = trName(item);
      img.width = 400;
      img.height = 300;
      img.decoding = 'async';
      if (photoIndex < EAGER_IMAGES) img.setAttribute('fetchpriority', 'high');
      else img.loading = 'lazy';
      setImage(img, item.img, CARD_SIZES, false);
      media.appendChild(img);
      card.appendChild(media);
    } else {
      card.classList.add('card--text');
    }
    const body = el('div', 'card__body');
    body.appendChild(renderNameButton(item));
    const desc = trDesc(item);
    if (desc) body.appendChild(el('p', 'card__desc', desc));
    if (item.weight) body.appendChild(el('p', 'card__weight', item.weight));
    const foot = el('div', 'card__foot');
    foot.append(el('span', 'card__price', money(item.price)), renderAddControl(item));
    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function renderRow(item) {
    const row = el('li', `card card--text row${item.oos ? ' card--oos' : ''}`);
    row.dataset.id = String(item.id);
    const body = el('div', 'card__body');
    body.appendChild(renderNameButton(item));
    const desc = trDesc(item);
    if (desc) body.appendChild(el('p', 'card__desc', desc));
    if (item.weight) body.appendChild(el('p', 'card__weight', item.weight));
    const side = el('div', 'row__side');
    side.append(el('span', 'card__price', money(item.price)), renderAddControl(item));
    row.append(body, side);
    return row;
  }

  function renderMenu() {
    const frag = document.createDocumentFragment();
    const used = new Set();
    const navTargets = new Set(Array.from(dom.tabs.querySelectorAll('a.tab')).map((a) => a.hash.slice(1)));
    state.items.clear();
    state.cards.clear();
    state.searchIndex = [];
    let navId = '';
    let photoIndex = 0;
    let barAdded = false;

    for (const sec of state.menu.sections) {
      const title = String(sec.title || '');
      const items = Array.isArray(sec.items) ? sec.items : [];
      if (!barAdded && BAR_START.has(title)) {
        barAdded = true;
        used.add(BAR.id);
        navId = BAR.id;
        frag.appendChild(renderHero(BAR.title, BAR.id));
      }
      const id = uniqueId(sectionId(sec), used);
      if (HERO_TITLES.has(title) && !items.length) {
        navId = id;
        frag.appendChild(renderHero(title, id));
        continue;
      }
      if (!items.length) continue;
      if (navTargets.has(id)) navId = id;

      const section = el('section', 'sec');
      section.id = id;
      section.dataset.nav = navId || id;
      const h = el('h2', 'sec__title', trSection(title));
      h.id = `${id}-title`;
      h.dataset.i18nSection = title;
      section.setAttribute('aria-labelledby', h.id);
      const withPhotos = items.some((it) => hasPhoto(it.img));
      const list = el('ul', withPhotos ? 'grid' : 'rows');

      for (const raw of items) {
        const item = Object.assign({}, raw, { id: String(raw.id), section: title, price: Number(raw.price) || 0 });
        state.items.set(item.id, item);
        const node = withPhotos ? renderCard(item, photoIndex) : renderRow(item);
        if (withPhotos && hasPhoto(item.img)) photoIndex += 1;
        list.appendChild(node);
        if (!state.cards.has(item.id)) state.cards.set(item.id, []);
        state.cards.get(item.id).push(node);
        state.searchIndex.push({ node, section, item, text: searchText(item) });
      }
      section.append(h, list);
      frag.appendChild(section);
    }

    dom.menu.textContent = '';
    dom.menu.appendChild(frag);
    dom.menu.removeAttribute('aria-busy');
    updateCardBadges();
    observeSections();
    applySearch(false);
  }

  function refreshTexts() {
    for (const [id, nodes] of state.cards) {
      const item = state.items.get(id);
      const name = trName(item);
      const desc = trDesc(item);
      for (const node of nodes) {
        const open = $('.card__open', node);
        if (open) open.textContent = name;
        const img = $('img', node);
        if (img) img.alt = name;
        const descEl = $('.card__desc', node);
        if (descEl && desc) descEl.textContent = desc;
        const add = $('.add', node);
        if (add) add.setAttribute('aria-label', `${t('add', 'Добавить в заказ')}: ${name}`);
      }
    }
    for (const row of state.searchIndex) row.text = searchText(row.item);
    updateCartView();
    updateOrderBar(false);
    if (state.dishId && !dom.dishSheet.hidden) fillDish(state.items.get(state.dishId));
    applySearch(false);
  }

  /* ---------- data loading ---------- */

  function validMenu(data) {
    return Boolean(data && Array.isArray(data.sections) && data.sections.some((s) => s && Array.isArray(s.items) && s.items.length));
  }

  function readCachedMenu() {
    try {
      const text = localStorage.getItem(MENU_CACHE_KEY);
      if (!text) return null;
      const data = JSON.parse(text);
      return validMenu(data) ? { text, data } : null;
    } catch (_) {
      return null;
    }
  }

  async function fetchText(url, timeoutMs, retries) {
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : 0;
      try {
        const res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (err) {
        lastErr = err;
        if (i < retries) await sleep(800 * (i + 1));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr || new Error('fetch failed');
  }

  function applyMenu(data, text) {
    state.menu = data;
    state.menuText = text;
    renderMenu();
    updateCartView();
    updateOrderBar(false);
  }

  async function loadMenu() {
    if (state.loading) return;
    state.loading = true;
    try {
      const text = await fetchText(MENU_URL, 8000, 2);
      const data = JSON.parse(text);
      if (!validMenu(data)) throw new Error('empty menu');
      if (text !== state.menuText) {
        const isUpdate = Boolean(state.menu);
        applyMenu(data, text);
        try {
          localStorage.setItem(MENU_CACHE_KEY, text);
        } catch (_) {}
        if (isUpdate) toast(t('menu.updated', 'Меню обновлено'));
      }
    } catch (err) {
      if (state.menu) toast(t('menu.offline', 'Нет сети — показано сохранённое меню'));
      else showLoadError();
    } finally {
      state.loading = false;
      state.lastFetch = Date.now();
    }
  }

  function showLoadError() {
    const box = el('div', 'state');
    box.setAttribute('role', 'alert');
    box.appendChild(el('p', 'state__hint', t('menu.error', 'Не удалось загрузить меню. Проверьте интернет.')));
    const btn = el('button', 'btn-ghost', t('menu.retry', 'Повторить'));
    btn.type = 'button';
    btn.dataset.action = 'retry';
    box.appendChild(btn);
    dom.menu.textContent = '';
    dom.menu.appendChild(box);
    dom.menu.removeAttribute('aria-busy');
  }

  /* ---------- search ---------- */

  let searchTimer = 0;

  function applySearch(scroll) {
    const words = normalize(dom.search.value).split(' ').filter(Boolean);
    const active = words.length > 0;
    dom.searchClear.hidden = !active;
    document.body.classList.toggle('is-searching', active);
    const hits = new Set();
    let total = 0;
    for (const row of state.searchIndex) {
      const match = !active || words.every((w) => row.text.includes(w));
      row.node.hidden = !match;
      if (match) {
        total += 1;
        hits.add(row.section);
      }
    }
    dom.menu.querySelectorAll('.sec').forEach((sec) => {
      sec.hidden = active && !hits.has(sec);
    });
    dom.menu.querySelectorAll('.hero').forEach((hero) => {
      hero.hidden = active;
    });
    dom.searchEmpty.hidden = !active || total > 0 || !state.menu;
    if (scroll && active) {
      const top = dom.menu.getBoundingClientRect().top + window.scrollY - stickyHeight();
      if (window.scrollY > top) window.scrollTo(0, Math.max(0, top));
    }
  }

  function clearSearch(focus) {
    if (!dom.search.value) return;
    dom.search.value = '';
    applySearch(false);
    if (focus) dom.search.focus();
  }

  /* ---------- category tabs ---------- */

  let observer = null;
  let navLockUntil = 0;
  let activeNav = null;
  let scrollFixTimer = 0;
  const visibleSections = new Set();

  function stickyHeight() {
    return dom.hdr.offsetHeight - dom.hdrBrand.offsetHeight;
  }

  function syncHeaderVars() {
    const root = document.documentElement.style;
    root.setProperty('--brand-h', `${dom.hdrBrand.offsetHeight}px`);
    root.setProperty('--sticky-h', `${stickyHeight()}px`);
  }

  function setActiveTab(id) {
    if (id === activeNav) return;
    activeNav = id;
    let active = null;
    dom.tabs.querySelectorAll('a.tab').forEach((a) => {
      const on = a.hash.slice(1) === id || (!id && (a.getAttribute('href') === '#'));
      a.classList.toggle('is-active', on);
      if (on) {
        a.setAttribute('aria-current', 'true');
        active = a;
      } else a.removeAttribute('aria-current');
    });
    if (!active) return;
    const nav = dom.tabs;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    const max = nav.scrollWidth - nav.clientWidth;
    nav.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function observeSections() {
    if (observer) observer.disconnect();
    visibleSections.clear();
    if (!('IntersectionObserver' in window)) return;
    const top = Math.round(stickyHeight()) + 2;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleSections.add(entry.target);
          else visibleSections.delete(entry.target);
        }
        if (Date.now() < navLockUntil) return;
        updateActiveFromScroll();
      },
      { rootMargin: `-${top}px 0px -55% 0px`, threshold: 0 },
    );
    dom.menu.querySelectorAll('.sec, .hero').forEach((node) => observer.observe(node));
  }

  function updateActiveFromScroll() {
    if (window.scrollY < 40) {
      setActiveTab('');
      return;
    }
    let first = null;
    let firstTop = Infinity;
    for (const node of visibleSections) {
      if (node.hidden) continue;
      const top = node.getBoundingClientRect().top;
      if (top < firstTop) {
        firstTop = top;
        first = node;
      }
    }
    if (first) setActiveTab(first.dataset.nav || first.id);
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    navLockUntil = Date.now() + 1000;
    setActiveTab(id);
    const smooth = !reducedMotion();
    const go = (behavior) => {
      const top = target.getBoundingClientRect().top + window.scrollY - stickyHeight() - 6;
      window.scrollTo({ top: Math.max(0, top), behavior });
    };
    go(smooth ? 'smooth' : 'auto');
    clearTimeout(scrollFixTimer);
    // content-visibility:auto sections above the target change height once rendered.
    scrollFixTimer = setTimeout(() => {
      const offset = target.getBoundingClientRect().top - stickyHeight() - 6;
      if (Math.abs(offset) > 4) go('auto');
    }, smooth ? 750 : 80);
  }

  function onTabClick(e) {
    const link = e.target.closest('a.tab');
    if (!link) return;
    e.preventDefault();
    clearSearch(false);
    const id = link.hash.slice(1);
    if (!id) {
      scrollToTop();
      return;
    }
    scrollToSection(id);
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  }

  function scrollToTop() {
    navLockUntil = Date.now() + 800;
    setActiveTab('');
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  let scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      dom.toTop.classList.toggle('is-visible', window.scrollY > 700);
      if (window.scrollY < 40 && Date.now() >= navLockUntil) setActiveTab('');
    });
  }

  /* ---------- cart ---------- */

  const cartRows = new Map();

  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
      if (!saved || Date.now() - saved.at > CART_TTL_MS || !Array.isArray(saved.lines)) return [];
      return saved.lines
        .filter((l) => l && l.id != null && l.qty > 0)
        .map((l) => ({ id: String(l.id), qty: Math.min(99, Math.floor(l.qty)), name: String(l.name || ''), price: Number(l.price) || 0 }));
    } catch (_) {
      return [];
    }
  }

  function saveCart() {
    try {
      if (state.cart.length) localStorage.setItem(CART_KEY, JSON.stringify({ at: Date.now(), lines: state.cart }));
      else localStorage.removeItem(CART_KEY);
    } catch (_) {}
  }

  function lineInfo(line) {
    const item = state.items.get(line.id);
    return {
      name: item ? trName(item) : line.name,
      price: item ? item.price : line.price,
    };
  }

  function cartQty(id) {
    const line = state.cart.find((l) => l.id === id);
    return line ? line.qty : 0;
  }

  function cartTotals() {
    let subtotal = 0;
    let count = 0;
    for (const line of state.cart) {
      subtotal += lineInfo(line).price * line.qty;
      count += line.qty;
    }
    const service = Math.round(subtotal * SERVICE_RATE);
    return { subtotal, service, total: subtotal + service, count };
  }

  function addToCart(id, source) {
    const item = state.items.get(id);
    if (!item || item.oos) return;
    const line = state.cart.find((l) => l.id === id);
    if (line) line.qty = Math.min(99, line.qty + 1);
    else state.cart.push({ id, qty: 1, name: item.name, price: item.price });
    cartChanged([id], true);
    feedback(source);
    announce(`${t('added', 'Добавлено в заказ')}: ${trName(item)}`);
  }

  function changeQty(id, delta) {
    const line = state.cart.find((l) => l.id === id);
    if (!line) {
      if (delta > 0) addToCart(id, null);
      return;
    }
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter((l) => l !== line);
    else line.qty = Math.min(99, line.qty);
    cartChanged([id], delta > 0);
  }

  function clearCart() {
    const ids = state.cart.map((l) => l.id);
    state.cart = [];
    cartChanged(ids, false);
  }

  function cartChanged(ids, bump) {
    saveCart();
    updateCardBadges(ids);
    updateCartView();
    updateOrderBar(bump);
    if (state.dishId) updateDishControls();
  }

  function updateCardBadges(ids) {
    const list = ids || Array.from(state.cards.keys());
    for (const id of list) {
      const nodes = state.cards.get(id);
      if (!nodes) continue;
      const qty = cartQty(id);
      for (const node of nodes) {
        const badge = $('.add__qty', node);
        if (!badge) continue;
        badge.hidden = qty === 0;
        badge.textContent = String(qty);
      }
    }
  }

  function createCartRow(line) {
    const li = el('li', 'cart-line');
    li.dataset.id = line.id;
    const name = el('p', 'cart-line__name');
    const price = el('p', 'cart-line__price');
    const stepper = el('div', 'stepper');
    const dec = el('button', 'qty-btn', '−');
    dec.type = 'button';
    dec.dataset.action = 'dec';
    const qty = el('output', 'stepper__val');
    const inc = el('button', 'qty-btn', '+');
    inc.type = 'button';
    inc.dataset.action = 'inc';
    stepper.append(dec, qty, inc);
    li.append(name, price, stepper);
    return { li, name, price, qty, dec, inc };
  }

  function updateCartView() {
    if (!dom.cartItems) return;
    const ids = new Set(state.cart.map((l) => l.id));
    for (const [id, row] of cartRows) {
      if (!ids.has(id)) {
        row.li.remove();
        cartRows.delete(id);
      }
    }
    for (const line of state.cart) {
      let row = cartRows.get(line.id);
      if (!row) {
        row = createCartRow(line);
        cartRows.set(line.id, row);
        dom.cartItems.appendChild(row.li);
      }
      const info = lineInfo(line);
      row.name.textContent = info.name;
      row.price.textContent = '';
      row.price.append(`${money(info.price)} × ${line.qty} = `, el('b', '', money(info.price * line.qty)));
      row.qty.textContent = String(line.qty);
      row.dec.setAttribute('aria-label', `${t('qty.dec', 'Убрать одну порцию')}: ${info.name}`);
      row.inc.setAttribute('aria-label', `${t('qty.inc', 'Добавить ещё одну')}: ${info.name}`);
    }
    const totals = cartTotals();
    const empty = state.cart.length === 0;
    dom.cartEmpty.hidden = !empty;
    dom.cartSum.hidden = empty;
    dom.subtotal.textContent = money(totals.subtotal);
    dom.service.textContent = money(totals.service);
    dom.total.textContent = money(totals.total);
  }

  function updateOrderBar(bump) {
    const totals = cartTotals();
    const visible = totals.count > 0;
    dom.orderBar.classList.toggle('is-visible', visible);
    document.body.classList.toggle('has-order', visible);
    dom.obCount.textContent = countLabel(totals.count);
    dom.obSum.textContent = money(totals.subtotal);
    if (bump && visible && !reducedMotion()) restartAnimation(dom.obCount, 'is-bumped');
  }

  function restartAnimation(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  function feedback(source) {
    if (navigator.vibrate && !reducedMotion()) {
      try {
        navigator.vibrate(12);
      } catch (_) {}
    }
    if (source && source.classList.contains('add') && !reducedMotion()) restartAnimation(source, 'is-pressed');
  }

  function announce(text) {
    dom.srLive.textContent = '';
    setTimeout(() => {
      dom.srLive.textContent = text;
    }, 30);
  }

  function readTable() {
    let value = '';
    try {
      const raw = new URLSearchParams(location.search).get('table');
      if (raw != null) {
        const v = String(raw).trim().slice(0, 6);
        if (/^[0-9A-Za-zА-Яа-яЁё-]{1,6}$/.test(v)) value = v;
        if (value) sessionStorage.setItem(TABLE_KEY, value);
      }
      if (!value) value = sessionStorage.getItem(TABLE_KEY) || '';
    } catch (_) {}
    return value;
  }

  function renderTable() {
    dom.tableChip.hidden = !state.table;
    dom.tableChip.textContent = state.table ? `${t('cart.table', 'Стол')} ${state.table}` : '';
  }

  /* ---------- sheets (bottom sheet / dialog) ---------- */

  let openSheetEl = null;
  let lastFocus = null;
  let lockedY = 0;
  let welcomeOpen = false;

  function lockScroll(on) {
    const body = document.body;
    if (on) {
      if (body.classList.contains('is-locked')) return;
      lockedY = window.scrollY;
      body.style.top = `-${lockedY}px`;
      body.classList.add('is-locked');
    } else if (body.classList.contains('is-locked')) {
      body.classList.remove('is-locked');
      body.style.top = '';
      window.scrollTo(0, lockedY);
    }
  }

  function setPageInert(on) {
    for (const node of [dom.hdr, dom.menu, dom.searchEmpty, dom.foot, dom.orderBar, dom.toTop, $('.skip-link')]) {
      if (!node) continue;
      if (on) {
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute('inert');
        node.removeAttribute('aria-hidden');
      }
    }
  }

  function focusables(root) {
    return Array.from(root.querySelectorAll('button, [href], input, summary, output[tabindex], [tabindex]:not([tabindex="-1"])')).filter(
      (n) => !n.disabled && !n.closest('[hidden]') && n.getClientRects().length > 0,
    );
  }

  function openSheet(sheet) {
    if (!sheet || openSheetEl === sheet) return;
    if (openSheetEl) closeSheet(openSheetEl, true);
    else lastFocus = document.activeElement;
    openSheetEl = sheet;
    sheet.hidden = false;
    lockScroll(true);
    setPageInert(true);
    void sheet.offsetWidth;
    sheet.classList.add('is-open');
    const panel = $('.sheet__panel', sheet);
    panel.style.transform = '';
    const scroller = $('.sheet__scroll', sheet);
    if (scroller) scroller.scrollTop = 0;
    const first = $('.icon-btn', panel);
    (first || panel).focus({ preventScroll: true });
  }

  function closeSheet(sheet, switching) {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open');
    const panel = $('.sheet__panel', sheet);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (!sheet.classList.contains('is-open')) sheet.hidden = true;
    };
    if (switching || reducedMotion()) finish();
    else {
      panel.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 420);
    }
    if (sheet === dom.dishSheet) state.dishId = null;
    if (switching) return;
    openSheetEl = null;
    setPageInert(false);
    lockScroll(false);
    if (lastFocus && document.contains(lastFocus) && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function initSwipe(sheet) {
    const panel = $('.sheet__panel', sheet);
    let startY = 0;
    let lastY = 0;
    let startT = 0;
    let tracking = false;
    let dragging = false;
    let scroller = null;

    panel.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1 || wideQuery.matches) return;
        scroller = e.target.closest('.sheet__scroll');
        tracking = true;
        dragging = false;
        startY = lastY = e.touches[0].clientY;
        startT = Date.now();
      },
      { passive: true },
    );

    panel.addEventListener(
      'touchmove',
      (e) => {
        if (!tracking) return;
        lastY = e.touches[0].clientY;
        const dy = lastY - startY;
        if (!dragging) {
          if (dy < -4 || (scroller && scroller.scrollTop > 0)) {
            tracking = false;
            return;
          }
          if (dy < 6) return;
          dragging = true;
          panel.classList.add('is-dragging');
        }
        e.preventDefault();
        panel.style.transform = `translate3d(0, ${Math.max(0, dy)}px, 0)`;
      },
      { passive: false },
    );

    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      const dy = lastY - startY;
      const velocity = dy / Math.max(1, Date.now() - startT);
      panel.style.transform = '';
      if (dy > 110 || (dy > 40 && velocity > 0.5)) closeSheet(sheet);
    };
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
  }

  function fillDish(item) {
    if (!item) return;
    const name = trFullName(item);
    if (hasPhoto(item.img)) {
      dom.dishMedia.hidden = false;
      dom.dishImg.alt = name;
      setImage(dom.dishImg, item.img, DISH_SIZES, true);
    } else {
      dom.dishMedia.hidden = true;
      dom.dishImg.removeAttribute('srcset');
      dom.dishImg.removeAttribute('src');
    }
    dom.dishName.textContent = name;
    dom.dishDesc.textContent = trDesc(item) || t('modal.fallbackDesc', 'Состав уточняйте у персонала.');
    dom.dishWeight.hidden = !item.weight;
    dom.dishWeight.textContent = item.weight || '';
    dom.dishPrice.textContent = money(item.price);
    updateDishControls();
  }

  function updateDishControls() {
    const item = state.items.get(state.dishId);
    if (!item) return;
    const qty = cartQty(item.id);
    dom.dishOos.hidden = !item.oos;
    dom.dishAdd.hidden = Boolean(item.oos) || qty > 0;
    dom.dishStepper.hidden = Boolean(item.oos) || qty === 0;
    dom.dishQty.textContent = String(qty);
  }

  function openDish(id) {
    const item = state.items.get(id);
    if (!item) return;
    state.dishId = id;
    fillDish(item);
    openSheet(dom.dishSheet);
  }

  /* ---------- welcome ---------- */

  function initWelcome() {
    if (!document.documentElement.classList.contains('show-welcome')) {
      scheduleVisit();
      return;
    }
    welcomeOpen = true;
    lastFocus = null;
    setPageInert(true);
    lockScroll(true);
    const go = $('.welcome__go', dom.welcome);
    if (go) go.focus({ preventScroll: true });
  }

  function closeWelcome() {
    if (!welcomeOpen) return;
    welcomeOpen = false;
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch (_) {}
    const finish = () => {
      document.documentElement.classList.remove('show-welcome');
      dom.welcome.classList.remove('is-leaving');
      setPageInert(false);
      lockScroll(false);
      dom.menu.focus({ preventScroll: true });
    };
    if (reducedMotion()) finish();
    else {
      dom.welcome.classList.add('is-leaving');
      setTimeout(finish, 240);
    }
    scheduleVisit();
  }

  /* ---------- keyboard ---------- */

  function onKeydown(e) {
    const dialog = openSheetEl ? $('.sheet__panel', openSheetEl) : welcomeOpen ? dom.welcome : null;
    if (!dialog) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (openSheetEl) closeSheet(openSheetEl);
      else closeWelcome();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables(dialog);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const inside = dialog.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- language ---------- */

  async function setLanguage(code) {
    const i = api();
    if (!i) return;
    i.setLang(code);
    i.applyStatic();
    renderTable();
    if (state.menu) refreshTexts();
    if (await i.ensureMenuI18n()) {
      if (state.menu) refreshTexts();
    }
  }

  /* ---------- misc ---------- */

  function toast(message) {
    if (!dom.toasts || !message) return;
    const node = el('div', 'toast', message);
    dom.toasts.appendChild(node);
    requestAnimationFrame(() => node.classList.add('is-in'));
    setTimeout(() => {
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 300);
    }, 3200);
  }

  function scheduleVisit() {
    const run = () => startVisit('kitchen');
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 3000);
  }

  /** Guest visit counter for the admin analytics; never blocks or surfaces errors. */
  function startVisit(choice) {
    const VISIT_KEY = 'fm_visit_id';
    try {
      if (sessionStorage.getItem(VISIT_KEY)) return;
    } catch (_) {
      return;
    }
    const t0 = Date.now();
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : 0;
    fetch(`${API_BASE}/api/visits/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname || '/', choice }),
      keepalive: true,
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.id) return;
        sessionStorage.setItem(VISIT_KEY, data.id);
        const ping = () => {
          const body = JSON.stringify({ id: data.id, durationSec: Math.max(0, Math.floor((Date.now() - t0) / 1000)) });
          const url = `${API_BASE}/api/visits/ping`;
          if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
          else fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
        };
        setInterval(ping, 30000);
        window.addEventListener('pagehide', ping);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') ping();
        });
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && !/[?&]sw=1/.test(location.search)) return;
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'menu-updated') loadMenu();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  function onClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const host = target.closest('[data-id]');
    const id = host ? host.dataset.id : state.dishId;
    switch (target.dataset.action) {
      case 'add':
        if (host) addToCart(host.dataset.id, target);
        break;
      case 'open':
        if (host) openDish(host.dataset.id);
        break;
      case 'inc':
        if (id) changeQty(id, 1);
        break;
      case 'dec':
        if (id) changeQty(id, -1);
        break;
      case 'dish-add':
        if (state.dishId) addToCart(state.dishId, target);
        break;
      case 'close':
        closeSheet(target.closest('.sheet'));
        break;
      case 'cart-open':
        openSheet(dom.cartSheet);
        break;
      case 'cart-clear':
        clearCart();
        break;
      case 'lang':
        setLanguage(target.dataset.lang);
        break;
      case 'search-clear':
        clearSearch(true);
        break;
      case 'top':
        scrollToTop();
        break;
      case 'welcome-go':
        closeWelcome();
        break;
      case 'retry':
        loadMenu();
        break;
      default:
        break;
    }
  }

  function init() {
    Object.assign(dom, {
      hdr: $('#hdr'),
      hdrBrand: $('#hdrBrand'),
      tabs: $('#tabs'),
      search: $('#q'),
      searchClear: $('.search__clear'),
      searchEmpty: $('#searchEmpty'),
      menu: $('#menu'),
      foot: $('#foot'),
      orderBar: $('#orderBar'),
      obCount: $('#obCount'),
      obSum: $('#obSum'),
      toTop: $('#toTop'),
      cartSheet: $('#cartSheet'),
      cartItems: $('#cartItems'),
      cartEmpty: $('#cartEmpty'),
      cartSum: $('#cartSum'),
      subtotal: $('#subtotalPrice'),
      service: $('#servicePrice'),
      total: $('#totalPrice'),
      tableChip: $('#tableChip'),
      dishSheet: $('#dishSheet'),
      dishMedia: $('#dishMedia'),
      dishImg: $('#dishImg'),
      dishName: $('#dishName'),
      dishDesc: $('#dishDesc'),
      dishWeight: $('#dishWeight'),
      dishPrice: $('#dishPrice'),
      dishAdd: $('#dishAdd'),
      dishOos: $('#dishOos'),
      dishStepper: $('#dishStepper'),
      dishQty: $('#dishQty'),
      welcome: $('#welcome'),
      toasts: $('#toasts'),
      srLive: $('#srLive'),
    });

    document.addEventListener('error', onImageError, true);
    document.addEventListener('load', onImageLoad, true);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    dom.tabs.addEventListener('click', onTabClick);
    dom.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applySearch(true), 120);
    });
    dom.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dom.search.blur();
      if (e.key === 'Escape') clearSearch(true);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    initSwipe(dom.cartSheet);
    initSwipe(dom.dishSheet);

    syncHeaderVars();
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        syncHeaderVars();
        if (state.menu) observeSections();
      }).observe(dom.hdr);
    } else window.addEventListener('resize', syncHeaderVars, { passive: true });

    const i = api();
    if (i) i.applyStatic();
    state.table = readTable();
    renderTable();
    state.cart = loadCart();

    const cached = readCachedMenu();
    if (cached) applyMenu(cached.data, cached.text);
    else {
      updateCartView();
      updateOrderBar(false);
    }
    initWelcome();

    const ready = i ? i.ensureMenuI18n() : Promise.resolve(false);
    ready.then((loaded) => {
      if (loaded && state.menu) refreshTexts();
    });
    loadMenu().then(() => {
      if (location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)))) {
        scrollToSection(decodeURIComponent(location.hash.slice(1)));
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - state.lastFetch > REFRESH_AFTER_MS) loadMenu();
    });
    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
