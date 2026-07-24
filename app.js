/**
 * Runtime config for guest menu + admin.html
 * For production, set API URL to your deployed backend, e.g.:
 *   window.FRIENDLY_API_BASE = 'https://your-api.onrender.com';
 * Leave empty to auto-use same hostname on port 4000 (local Live Server).
 */
window.FRIENDLY_CONFIG = window.FRIENDLY_CONFIG || {
  // Example production:
  // apiBase: 'https://friendly-menu-api.onrender.com',
  apiBase: '',
  adminUrl: '',
};

(function applyFriendlyConfig() {
  const cfg = window.FRIENDLY_CONFIG || {};
  if (cfg.apiBase) {
    window.FRIENDLY_API_BASE = String(cfg.apiBase).replace(/\/$/, '');
  } else if (!window.FRIENDLY_API_BASE) {
    const host = typeof location !== 'undefined' ? location.hostname : '127.0.0.1';
    const protocol = typeof location !== 'undefined' ? location.protocol : 'http:';
    // Local: Live Server → API on :4000. Production same-origin: use relative ''
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local');
    window.FRIENDLY_API_BASE = isLocal
      ? protocol + '//' + host + ':4000'
      : ''; // same origin /api via reverse proxy
  }
  if (cfg.adminUrl) {
    window.FRIENDLY_ADMIN_URL = String(cfg.adminUrl).replace(/\/$/, '');
  }
})();


const SERVICE_RATE = 0.15;
const THEME_KEY = 'friendly-menu-theme';

let cart = [];
let currentModalItem = null;
let items = {};

function formatTg(amount) {
    return Math.round(amount) + ' тг';
}

function escapeHtml(text) {
    const s = String(text ?? '');
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeMenuImagePath(path) {
    if (!path) return 'image/nono.png';
    let p = String(path).trim().replace(/^\.\//, '');
    p = p.replace(/\\/g, '/');
    while (p.includes('/./')) p = p.replace('/./', '/');
    p = p.replace(/\/{2,}/g, '/');
    p = p.replace(/^image\/image\//i, 'image/');
    if (!/^image\//i.test(p)) {
        p = 'image/' + p.replace(/^\/+/, '');
    }
    return p;
}

function buildItemsCatalog() {
    const out = {};
    const base = window.MENU_ITEMS || {};
    const det = window.ITEM_DETAILS || {};
    for (const idStr of Object.keys(base)) {
        const id = Number.isFinite(Number(idStr)) && String(Number(idStr)) === String(idStr) ? Number(idStr) : idStr;
        const b = base[idStr];
        const d = det[idStr];
        const rawImg = (d && d.img) || b.img || 'image/nono.png';
        out[id] = {
            name: (d && d.name) || b.name,
            price: typeof b.price === 'number' ? b.price : Number(b.price) || 0,
            img: normalizeMenuImagePath(rawImg),
            desc: (d && d.desc) || b.desc || ''
        };
    }
    return out;
}

function imgSrcForPage(path) {
    const normalized = normalizeMenuImagePath(path);
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('./')) return normalized;
    return './' + normalized.replace(/^\//, '');
}

function bindMenuImageFallbacks() {
    document.querySelectorAll('#menu-root img.item-image').forEach((img) => {
        img.addEventListener(
            'error',
            function onImgErr() {
                img.removeEventListener('error', onImgErr);
                if (img.dataset.fallback === '1') return;
                img.dataset.fallback = '1';
                img.src = './image/nono.png';
            },
            { passive: true }
        );
    });
}

function initModalImageFallback() {
    const img = document.getElementById('modalImage');
    if (!img || img.dataset.fallbackBound === '1') return;
    img.dataset.fallbackBound = '1';
    img.addEventListener('error', () => {
        if (img.dataset.fallback === '1') return;
        img.dataset.fallback = '1';
        img.src = './image/nono.png';
    });
}

function getSectionId(section) {
    if (section && section.anchor) return section.anchor;
    const title = String(section && section.title ? section.title : '').trim();
    const aliasMap = {
        'Меню Грузия': 'menu-gruziya',
        'Меню Европа': 'menu-evropa',
        'Горячие закуски': 'goryachie-zakuski',
        'Холодные закуски': 'holodnye-zakuski'
    };
    if (aliasMap[title]) return aliasMap[title];
    return title.toLowerCase().replace(/[^а-яa-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function renderMenu() {
    const root = document.getElementById('menu-root');
    if (!root || !window.MENU_SECTIONS) return;

    const html = window.MENU_SECTIONS.map((section) => {
        const sectionId = getSectionId(section);
        const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : '';
        const title = escapeHtml(section.title);
        const titleClass = section.title === 'Меню Грузия' || section.title === 'Меню Европа' ? 'title__menu title__menu--hero' : 'title__menu';
        if (!section.items || section.items.length === 0) {
            return `<h2 class="${titleClass}"${idAttr}>${title}</h2>`;
        }
        const itemsHtml = section.items.map(renderMenuItemCard).join('');
        return `<h2 class="${titleClass}"${idAttr}>${title}</h2><div class="menu-grid">${itemsHtml}</div>`;
    }).join('');

    root.innerHTML = html;
    bindMenuImageFallbacks();
    initCategoryNav();
}

function renderMenuItemCard(it) {
    const id = it.id;
    const name = escapeHtml(it.name);
    const priceDisp = escapeHtml(it.priceDisplay || '');
    const out = it.availability === 'OUT_OF_STOCK';
    const imgPath = it.img ? imgSrcForPage(it.img) : '';
    const imgBlock = imgPath
        ? `<div class="item-image-wrap"><img src="${imgPath}" alt="" class="item-image" loading="lazy" width="400" height="280" decoding="async"></div>`
        : '';
    const itemClass = (imgPath ? 'menu-item' : 'menu-item menu-item--no-image') + (out ? ' menu-item--oos' : '');
    const addBtn = out
        ? `<span class="badge badge--oos">нет в наличии</span>`
        : `<button type="button" class="add-btn" data-add="${id}" aria-label="Добавить в заказ">+</button>`;
    return `
        <div class="${itemClass}" data-item-id="${id}" role="button" tabindex="0">
            ${imgBlock}
            <div class="item-content">
                <div class="item-name">${name}</div>
                <div class="item-footer">
                    <div class="item-price">${priceDisp}</div>
                    ${addBtn}
                </div>
            </div>
        </div>`;
}

function onMenuRootClick(e) {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
        addToCart(e, addBtn.getAttribute('data-add'));
        return;
    }
    const card = e.target.closest('.menu-item[data-item-id]');
    if (card && !e.target.closest('.add-btn')) {
        openModal(card.getAttribute('data-item-id'));
    }
}

function onMenuRootKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.menu-item[data-item-id]');
    if (!card || e.target.closest('.add-btn')) return;
    e.preventDefault();
    openModal(card.getAttribute('data-item-id'));
}

function addToCart(event, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const id = Number.isFinite(Number(itemId)) && String(Number(itemId)) === String(itemId) ? Number(itemId) : itemId;
    const item = items[id];
    if (!item) return;

    const existing = cart.find((i) => i.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id,
            name: item.name,
            price: item.price,
            img: item.img,
            desc: item.desc,
            quantity: 1
        });
    }

    updateCart();
    showCart();
}

function changeQty(itemId, delta) {
    const id = Number(itemId);
    const existing = cart.find((i) => i.id === id);
    if (!existing) return;

    existing.quantity += delta;
    if (existing.quantity <= 0) {
        cart = cart.filter((i) => i.id !== id);
    }

    updateCart();
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.querySelector('.cart-count');
    const totalPriceEl = document.getElementById('totalPrice');
    const subtotalEl = document.getElementById('subtotalPrice');
    const serviceEl = document.getElementById('servicePrice');

    if (!cartItems || !cartCount || !totalPriceEl) return;

    cartItems.innerHTML = '';

    let subtotal = 0;
    let count = 0;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="cart-empty">Добавьте блюда кнопкой «+»</p>';
    } else {
        cart.forEach((item) => {
            subtotal += item.price * item.quantity;
            count += item.quantity;

            cartItems.innerHTML += `
                <div class="cart-item">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    <div class="cart-item-controls">
                        <button type="button" class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
                        <span class="qty">${item.quantity}</span>
                        <button type="button" class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                    </div>
                </div>
            `;
        });
    }

    const service = Math.round(subtotal * SERVICE_RATE);
    const grandTotal = subtotal + service;

    cartCount.textContent = String(count);
    if (subtotalEl) subtotalEl.textContent = formatTg(subtotal);
    if (serviceEl) serviceEl.textContent = formatTg(service);
    totalPriceEl.textContent = formatTg(grandTotal);
}

function toggleCart() {
    document.getElementById('cartPanel').classList.toggle('active');
}

function hideCart() {
    document.getElementById('cartPanel').classList.remove('active');
}

function showCart() {
    document.getElementById('cartPanel').classList.add('active');
}

function openModal(itemId) {
    const id = Number(itemId);
    const item = items[id];
    if (!item) return;

    currentModalItem = id;

    const imgEl = document.getElementById('modalImage');
    imgEl.src = imgSrcForPage(item.img);
    imgEl.alt = item.name;
    document.getElementById('modalName').textContent = item.name;
    document.getElementById('modalDescription').textContent = item.desc || 'Состав уточняйте у персонала.';
    document.getElementById('modalPrice').textContent = item.price + 'тг';

    document.getElementById('modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentModalItem = null;
}

function closeModalOnBackdrop(event) {
    if (event.target === document.getElementById('modal')) {
        closeModal();
    }
}

function addFromModal() {
    if (currentModalItem != null) {
        addToCart(null, currentModalItem);
        closeModal();
    }
}

function setActiveCategory(hash) {
    const links = Array.from(document.querySelectorAll('.category'));
    if (!links.length) return;

    const normalized = hash && hash !== '#' ? hash.replace(/^#/, '') : '';
    links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const linkHash = href.replace(/^#/, '');
        const isActive = normalized ? linkHash === normalized : href === '#' || href === '';
        link.classList.toggle('active', isActive);
        link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
}

function initCategoryNav() {
    const links = Array.from(document.querySelectorAll('.category'));
    if (!links.length) return;

    links.forEach((link) => {
        link.addEventListener('click', function (event) {
            const href = link.getAttribute('href') || '';
            if (!href || href === '#') {
                event.preventDefault();
                setActiveCategory('#');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }
                return;
            }

            if (!href.startsWith('#')) return;

            const targetId = href.slice(1);
            const target = document.getElementById(targetId);
            if (!target) return;

            event.preventDefault();
            setActiveCategory(href);
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', href);
            }
        });
    });

    const initialHash = window.location.hash || '#';
    setActiveCategory(initialHash);

    window.addEventListener('hashchange', function () {
        setActiveCategory(window.location.hash || '#');
    });

    if ('IntersectionObserver' in window) {
        const headings = Array.from(document.querySelectorAll('.title__menu[id]'));
        if (headings.length) {
            const observer = new IntersectionObserver((entries) => {
                const visibleEntry = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (visibleEntry) {
                    const id = visibleEntry.target.id;
                    setActiveCategory(`#${id}`);
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState(null, '', `#${id}`);
                    }
                }
            }, {
                rootMargin: '-35% 0px -45% 0px',
                threshold: [0.1, 0.3, 0.5, 0.7]
            });

            headings.forEach((heading) => observer.observe(heading));
        }
    }
}

function initSearch() {
    const input = document.querySelector('.search-input');
    if (!input) return;
    input.addEventListener('input', function (e) {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.menu-item').forEach((item) => {
            const nameEl = item.querySelector('.item-name');
            const name = nameEl ? nameEl.textContent.toLowerCase() : '';
            if (name.includes(query)) {
                item.style.removeProperty('display');
            } else {
                item.style.display = 'none';
            }
        });
    });
}

function initToTopButtons() {
    const btnR = document.getElementById('toTopRight');
    const btnL = document.getElementById('toTopLeft');
    const menuRoot = document.getElementById('menu-root');
    if (!btnR && !btnL) return;

    function goTop() {
        if (menuRoot) {
            menuRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setActiveCategory('#');
    }

    if (btnR) btnR.addEventListener('click', goTop);
    if (btnL) btnL.addEventListener('click', goTop);

    function onScroll() {
        const show = window.scrollY > 120;
        [btnR, btnL].forEach((b) => {
            if (!b) return;
            b.classList.toggle('hidden', !show);
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const fab = document.getElementById('themeFab');
    if (fab) {
        fab.setAttribute(
            'aria-label',
            isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'
        );
        fab.setAttribute('title', isDark ? 'Светлая тема' : 'Тёмная тема');
        fab.classList.toggle('theme-fab--dark', isDark);
    }
    try {
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (_) {}
}

function initThemeToggle() {
    let saved = 'light';
    try {
        saved = localStorage.getItem(THEME_KEY) || 'light';
    } catch (_) {}
    if (saved !== 'dark' && saved !== 'light') saved = 'light';
    applyTheme(saved);

    const fab = document.getElementById('themeFab');
    if (!fab) return;
    fab.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });
}

function init() {
    items = buildItemsCatalog();
    renderMenu();

    const menuRoot = document.getElementById('menu-root');
    if (menuRoot) {
        menuRoot.addEventListener('click', onMenuRootClick);
        menuRoot.addEventListener('keydown', onMenuRootKeydown);
    }

    initSearch();
    initToTopButtons();
    initThemeToggle();
    initModalImageFallback();
    updateCart();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('lock-scroll');
});


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

function closePopup(choice) {
    const screen = document.getElementById('welcome-screen');
    screen.style.opacity = '0';

    setTimeout(() => {
        screen.style.display = 'none';
        document.body.classList.remove('lock-scroll');

        if (choice === 'hookah') {
            window.location.href = 'hookah.html';
        }
    }, 400);
}


/**
 * Live menu bridge: loads menu from API and applies Socket.io updates.
 * Falls back to static js/menu-data.js if the API is unreachable.
 *
 * Config (optional, before this script):
 *   window.FRIENDLY_API_BASE = 'http://localhost:4000';
 */
(function () {
  const BASE = (
    window.FRIENDLY_API_BASE ||
    (typeof location !== 'undefined'
      ? location.protocol + '//' + location.hostname + ':4000'
      : 'http://127.0.0.1:4000')
  ).replace(/\/$/, '');
  let socketScriptLoading = null;

  async function fetchMenu() {
    const res = await fetch(`${BASE}/api/menu`, { cache: 'no-store' });
    if (!res.ok) throw new Error('menu fetch failed');
    return res.json();
  }

  function apply(payload) {
    if (window.FriendlyMenu && typeof window.FriendlyMenu.applyLiveMenu === 'function') {
      window.FriendlyMenu.applyLiveMenu(payload);
    } else {
      if (payload.sections) window.MENU_SECTIONS = payload.sections;
      if (payload.items) window.MENU_ITEMS = payload.items;
      if (payload.details) window.ITEM_DETAILS = Object.assign({}, window.ITEM_DETAILS || {}, payload.details);
    }
  }

  function loadSocketIo() {
    if (window.io) return Promise.resolve();
    if (socketScriptLoading) return socketScriptLoading;
    socketScriptLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${BASE}/socket.io/socket.io.js`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return socketScriptLoading;
  }

  function connectRealtime() {
    loadSocketIo()
      .then(() => {
        const socket = window.io(BASE, { transports: ['websocket', 'polling'] });
        socket.on('menu:changed', async () => {
          try {
            apply(await fetchMenu());
          } catch (e) {
            console.warn('[friendly-live] refresh failed', e);
          }
        });
      })
      .catch((e) => console.warn('[friendly-live] socket unavailable', e));
  }

  async function boot() {
    try {
      const payload = await fetchMenu();
      apply(payload);
      console.info('[friendly-live] menu synced from API', payload.updatedAt);
    } catch (e) {
      console.warn('[friendly-live] using static menu fallback', e.message || e);
    }
    connectRealtime();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

