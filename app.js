const SERVICE_RATE = 0.15;
const THEME_KEY = 'friendly-menu-theme';
const MENU_CACHE_KEY = 'fm_menu_cache_v1';

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

function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, '&#39;');
}

function normalizeMenuImagePath(path) {
    if (!path) return 'image/nono.png';
    let p = String(path).trim().replace(/^\.\//, '');
    p = p.replace(/\\/g, '/');
    while (p.includes('/./')) p = p.replace('/./', '/');
    p = p.replace(/\/{2,}/g, '/');
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/uploads/')) return p;
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
    if (normalized.startsWith('/uploads/')) {
        const base = String(window.FRIENDLY_API_BASE || '').replace(/\/$/, '');
        return base ? base + normalized : normalized;
    }
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
    'К чаю': 'bar',
    'Барное меню': 'bar'
};

const KNOWN_SECTION_IDS = new Set(Object.values(SECTION_NAV_IDS));

function getSectionId(section) {
    const title = String(section && section.title ? section.title : '').trim();
    if (SECTION_NAV_IDS[title]) return SECTION_NAV_IDS[title];

    const raw = section && section.anchor ? String(section.anchor).trim() : '';
    if (raw) {
        // API seed often produces "soup-3", "main-courses-1" — strip numeric suffixes
        const stripped = raw.replace(/(-\d+)+$/g, '');
        if (KNOWN_SECTION_IDS.has(stripped)) return stripped;
        if (KNOWN_SECTION_IDS.has(raw)) return raw;
        return stripped || raw;
    }

    return title
        .toLowerCase()
        .replace(/[^а-яa-z0-9]+/gi, '-')
        .replace(/(^-|-$)/g, '');
}

function findSectionHeading(targetId, sectionTitle) {
    if (targetId) {
        const byId = document.getElementById(targetId);
        if (byId) return byId;
    }
    if (sectionTitle) {
        const byTitle = document.querySelector(
            `.title__menu[data-i18n-section="${CSS.escape(sectionTitle)}"]`
        );
        if (byTitle) return byTitle;
        // Nav label "Барное меню" maps to section "К чаю"
        if (sectionTitle === 'Барное меню') {
            const tea = document.querySelector('.title__menu[data-i18n-section="К чаю"]');
            if (tea) return tea;
        }
    }
    return null;
}

function i18n() {
    return window.FriendlyI18n || null;
}

function tr(key, fallback) {
    const api = i18n();
    if (!api) return fallback || key;
    const val = api.t(key);
    return val && val !== key ? val : (fallback || key);
}

function trSection(title) {
    const api = i18n();
    return api ? api.translateSection(title) : title;
}

function trItemName(id, fallback) {
    const api = i18n();
    return api ? api.translateItemName(id, fallback) : fallback;
}

function trItemDesc(id, fallback) {
    const api = i18n();
    return api ? api.translateItemDesc(id, fallback) : fallback;
}

function renderMenu() {
    const root = document.getElementById('menu-root');
    if (!root || !window.MENU_SECTIONS) return;

    const html = window.MENU_SECTIONS.map((section) => {
        const sectionId = getSectionId(section);
        const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : '';
        const titleRu = section.title;
        const title = escapeHtml(trSection(titleRu));
        const titleClass = titleRu === 'Меню Грузия' || titleRu === 'Меню Европа' ? 'title__menu title__menu--hero' : 'title__menu';
        if (!section.items || section.items.length === 0) {
            return `<h2 class="${titleClass}"${idAttr} data-i18n-section="${escapeHtml(titleRu)}">${title}</h2>`;
        }
        const itemsHtml = section.items.map((it, idx) => renderMenuItemCard(it, idx)).join('');
        return `<h2 class="${titleClass}"${idAttr} data-i18n-section="${escapeHtml(titleRu)}">${title}</h2><div class="menu-grid">${itemsHtml}</div>`;
    }).join('');

    root.innerHTML = html;
    bindMenuImageFallbacks();
    initCategoryNav();
    applySearchFilter();
    syncHeaderOffset();
    if (i18n()) i18n().applyStatic();
}

function renderMenuItemCard(it, idx) {
    const id = it.id;
    const nameRu = it.name || '';
    const name = escapeHtml(trItemName(id, nameRu));
    const priceDisp = escapeHtml(it.priceDisplay || '');
    const out = it.availability === 'OUT_OF_STOCK';
    const imgPath = it.img ? imgSrcForPage(it.img) : '';
    const imgBlock = imgPath
        ? `<div class="item-image-wrap"><img src="${escapeAttr(imgPath)}" alt="" class="item-image" loading="lazy" width="400" height="280" decoding="async"></div>`
        : '';
    const delay = Math.min(12, Number(idx) || 0) * 28;
    const itemClass =
        (imgPath ? 'menu-item' : 'menu-item menu-item--no-image') +
        (out ? ' menu-item--oos' : '') +
        ' menu-item--enter';
    const addBtn = out
        ? `<span class="badge badge--oos">${escapeHtml(tr('oos', 'нет в наличии'))}</span>`
        : `<button type="button" class="add-btn" data-add="${id}" aria-label="${escapeHtml(tr('add', 'Добавить в заказ'))}">+</button>`;
    return `
        <div class="${itemClass}" data-item-id="${id}" data-name-ru="${escapeHtml(nameRu)}" role="button" tabindex="0" style="--enter-delay:${delay}ms">
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
        cartItems.innerHTML = `<p class="cart-empty">${escapeHtml(tr('cart.empty', 'Добавьте блюда кнопкой «+»'))}</p>`;
    } else {
        cart.forEach((item) => {
            subtotal += item.price * item.quantity;
            count += item.quantity;
            const shownName = trItemName(item.id, item.name);

            cartItems.innerHTML += `
                <div class="cart-item">
                    <div class="cart-item-name">${escapeHtml(shownName)}</div>
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
    imgEl.alt = trItemName(id, item.name);
    document.getElementById('modalName').textContent = trItemName(id, item.name);
    document.getElementById('modalDescription').textContent =
        trItemDesc(id, item.desc || '') || tr('modal.fallbackDesc', 'Состав уточняйте у персонала.');
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

let categoryNavBound = false;
let categoryObserver = null;
let categoryNavLockUntil = 0;
let scrollAnimFrame = 0;
let navScrollAnimFrame = 0;
let scrollUserCancel = null;

function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

/** Soft cinematic ease — slow start & long gentle landing */
function easeInOutQuint(t) {
    return t < 0.5
        ? 16 * t * t * t * t * t
        : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

function getScrollY() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function setScrollY(y) {
    const v = Math.max(0, y);
    window.scrollTo(0, v);
    document.documentElement.scrollTop = v;
    if (document.body) document.body.scrollTop = v;
}

function clearScrollUserCancel() {
    if (!scrollUserCancel) return;
    window.removeEventListener('wheel', scrollUserCancel);
    window.removeEventListener('touchstart', scrollUserCancel);
    window.removeEventListener('keydown', scrollUserCancel);
    scrollUserCancel = null;
}

function smoothScrollY(toY) {
    const target = Math.max(0, Math.round(toY));
    if (prefersReducedMotion()) {
        setScrollY(target);
        return Promise.resolve();
    }

    const startY = getScrollY();
    const delta = target - startY;
    if (Math.abs(delta) < 1) return Promise.resolve();

    // Long, noticeable glide: ~1s short hops → ~2.1s long jumps
    const dist = Math.abs(delta);
    const duration = Math.min(2100, Math.max(1000, 720 + dist * 0.55));
    const start = performance.now();

    cancelAnimationFrame(scrollAnimFrame);
    clearScrollUserCancel();

    return new Promise((resolve) => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearScrollUserCancel();
            resolve();
        };

        scrollUserCancel = (e) => {
            if (e.type === 'keydown') {
                const k = e.key;
                if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(k)) {
                    return;
                }
            }
            cancelAnimationFrame(scrollAnimFrame);
            finish();
        };
        window.addEventListener('wheel', scrollUserCancel, { passive: true });
        window.addEventListener('touchstart', scrollUserCancel, { passive: true });
        window.addEventListener('keydown', scrollUserCancel);

        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            setScrollY(startY + delta * easeInOutQuint(t));
            if (t < 1) {
                scrollAnimFrame = requestAnimationFrame(step);
            } else {
                setScrollY(target);
                finish();
            }
        };
        scrollAnimFrame = requestAnimationFrame(step);
        categoryNavLockUntil = Date.now() + duration + 180;
    });
}

function smoothScrollX(el, toX) {
    if (!el) return;
    const target = Math.max(0, toX);
    if (prefersReducedMotion()) {
        el.scrollLeft = target;
        return;
    }
    const startX = el.scrollLeft;
    const delta = target - startX;
    if (Math.abs(delta) < 1) return;

    const duration = Math.min(900, Math.max(520, 380 + Math.abs(delta) * 0.9));
    const start = performance.now();
    cancelAnimationFrame(navScrollAnimFrame);
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        el.scrollLeft = startX + delta * easeInOutQuint(t);
        if (t < 1) navScrollAnimFrame = requestAnimationFrame(step);
        else el.scrollLeft = target;
    };
    navScrollAnimFrame = requestAnimationFrame(step);
}

function setActiveCategory(hash) {
    const links = Array.from(document.querySelectorAll('.category'));
    if (!links.length) return;

    const normalized = hash && hash !== '#' ? hash.replace(/^#/, '') : '';
    let activeLink = null;
    links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const linkHash = href.replace(/^#/, '');
        const isActive = normalized ? linkHash === normalized : href === '#' || href === '';
        link.classList.toggle('active', isActive);
        link.setAttribute('aria-current', isActive ? 'page' : 'false');
        if (isActive) activeLink = link;
    });

    scrollCategoryIntoNav(activeLink);
}

function scrollCategoryIntoNav(activeLink) {
    const nav = document.querySelector('.categories');
    if (!nav || !activeLink) return;

    const navRect = nav.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const linkCenter = linkRect.left + linkRect.width / 2;
    const navCenter = navRect.left + navRect.width / 2;
    const delta = linkCenter - navCenter;

    if (Math.abs(delta) < 6) return;

    const maxScroll = nav.scrollWidth - nav.clientWidth;
    const nextLeft = Math.max(0, Math.min(maxScroll, nav.scrollLeft + delta));
    smoothScrollX(nav, nextLeft);
}

function scrollToSection(target) {
    if (!target) return;
    syncHeaderOffset();
    const header = document.querySelector('.header');
    const offset = header ? Math.ceil(header.getBoundingClientRect().height) + 10 : 120;
    const top = getScrollY() + target.getBoundingClientRect().top - offset;
    return smoothScrollY(top);
}

function initCategoryNav() {
    const nav = document.querySelector('.categories');
    if (!nav) return;

    if (!categoryNavBound) {
        categoryNavBound = true;
        nav.addEventListener('click', function (event) {
            const link = event.target.closest('a.category');
            if (!link || !nav.contains(link)) return;

            const href = link.getAttribute('href') || '';
            if (!href || href === '#') {
                event.preventDefault();
                clearSearchQuiet();
                setActiveCategory('#');
                smoothScrollY(0);
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }
                return;
            }

            if (!href.startsWith('#')) return;

            const targetId = href.slice(1);
            const sectionTitle = link.getAttribute('data-i18n-section') || '';
            const target = findSectionHeading(targetId, sectionTitle);
            if (!target) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            clearSearchQuiet();
            setActiveCategory(href);
            scrollToSection(target);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', href);
            }
        });

        window.addEventListener('hashchange', function () {
            setActiveCategory(window.location.hash || '#');
        });
    }

    const initialHash = window.location.hash || '#';
    setActiveCategory(initialHash);

    if (categoryObserver) {
        categoryObserver.disconnect();
        categoryObserver = null;
    }

    if (!('IntersectionObserver' in window)) return;

    const headings = Array.from(document.querySelectorAll('.title__menu[id]'));
    if (!headings.length) return;

    categoryObserver = new IntersectionObserver(
        (entries) => {
            if (Date.now() < categoryNavLockUntil) return;
            const visibleEntry = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visibleEntry || !visibleEntry.target.id) return;
            const id = visibleEntry.target.id;
            clearTimeout(categoryObserver._debounce);
            categoryObserver._debounce = setTimeout(() => {
                if (Date.now() < categoryNavLockUntil) return;
                setActiveCategory(`#${id}`);
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', `#${id}`);
                }
            }, 90);
        },
        {
            rootMargin: '-120px 0px -55% 0px',
            threshold: [0.08, 0.2, 0.4, 0.6]
        }
    );

    headings.forEach((heading) => categoryObserver.observe(heading));
}

function clearSearchQuiet() {
    const input = document.querySelector('.search-input');
    if (!input || !input.value) return;
    input.value = '';
    applySearchFilter();
}

function applySearchFilter() {
    const input = document.querySelector('.search-input');
    const query = String(input && input.value ? input.value : '').trim().toLowerCase();
    const itemsEls = document.querySelectorAll('.menu-item');
    itemsEls.forEach((item) => {
        const nameEl = item.querySelector('.item-name');
        const name = nameEl ? nameEl.textContent.toLowerCase() : '';
        const nameRu = String(item.getAttribute('data-name-ru') || '').toLowerCase();
        const match = !query || name.includes(query) || nameRu.includes(query);
        item.classList.toggle('is-filtered-out', !match);
        item.setAttribute('aria-hidden', match ? 'false' : 'true');
        if (!match && document.activeElement === item) item.blur();
    });

    document.querySelectorAll('.menu-grid').forEach((grid) => {
        const visible = Array.from(grid.querySelectorAll('.menu-item')).some(
            (item) => !item.classList.contains('is-filtered-out')
        );
        const show = visible || !query;
        grid.classList.toggle('is-filtered-out', !show);
        const title = grid.previousElementSibling;
        if (title && title.classList.contains('title__menu')) {
            title.classList.toggle('is-filtered-out', !show);
        }
    });
}

function initSearch() {
    const input = document.querySelector('.search-input');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.addEventListener('input', applySearchFilter);
    input.addEventListener('search', applySearchFilter);
}

function syncHeaderOffset() {
    const header = document.querySelector('.header');
    if (!header) return;
    const h = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-offset', `${h}px`);
}

function initToTopButtons() {
    const btnR = document.getElementById('toTopRight');
    if (!btnR) return;

    function goTop() {
        setActiveCategory('#');
        smoothScrollY(0);
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    btnR.addEventListener('click', goTop);

    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            btnR.classList.toggle('hidden', window.scrollY <= 220);
            ticking = false;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', 'dark');
    try {
        localStorage.setItem(THEME_KEY, 'dark');
    } catch (_) {}
}

function initThemeToggle() {
    applyTheme();
}

function initLangSwitch() {
    const api = i18n();
    if (!api) return;
    api.applyStatic();
    document.querySelectorAll('.lang-switch__btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            api.setLang(btn.getAttribute('data-lang'));
            api.applyStatic();
            renderMenu();
            updateCart();
            syncHeaderOffset();
        });
    });
    window.addEventListener('friendly:lang', () => {
        api.applyStatic();
    });
}

function init() {
    items = buildItemsCatalog();
    initLangSwitch();
    renderMenu();

    const menuRoot = document.getElementById('menu-root');
    if (menuRoot) {
        menuRoot.addEventListener('click', onMenuRootClick);
        menuRoot.addEventListener('keydown', onMenuRootKeydown);
    }

    initSearch();
    syncHeaderOffset();
    window.addEventListener('resize', syncHeaderOffset, { passive: true });
    if (window.ResizeObserver) {
        const header = document.querySelector('.header');
        if (header) {
            const ro = new ResizeObserver(() => syncHeaderOffset());
            ro.observe(header);
        }
    }
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
        const sections = Array.isArray(payload.sections) ? payload.sections : null;
        const itemCount = sections
            ? sections.reduce((n, s) => n + ((s && s.items && s.items.length) || 0), 0)
            : 0;
        if (sections && itemCount === 0) {
            console.warn('[friendly-live] API menu empty — keeping current menu');
            return;
        }
        if (sections) window.MENU_SECTIONS = sections;
        if (payload.items && Object.keys(payload.items).length) window.MENU_ITEMS = payload.items;
        if (payload.details) window.ITEM_DETAILS = Object.assign({}, window.ITEM_DETAILS || {}, payload.details);
        items = buildItemsCatalog();
        renderMenu();
        updateCart();
        try {
            localStorage.setItem(
                MENU_CACHE_KEY,
                JSON.stringify({ at: Date.now(), payload: { sections: window.MENU_SECTIONS, items: window.MENU_ITEMS, details: window.ITEM_DETAILS, updatedAt: payload.updatedAt || null } })
            );
        } catch (_) {}
    },
    reload() {
        items = buildItemsCatalog();
        renderMenu();
    }
};

function closePopup(choice) {
    const screen = document.getElementById('welcome-screen');
    if (!screen) return;
    screen.style.opacity = '0';
    setTimeout(() => {
        screen.style.display = 'none';
        document.body.classList.remove('lock-scroll');
        if (choice === 'hookah') window.location.href = 'hookah.html';
    }, 400);
}

/**
 * Live menu bridge with wake-loader, retries, and offline cache.
 */
(function () {
  const BASE = String(
    window.FRIENDLY_API_BASE ||
      (typeof location !== 'undefined'
        ? location.protocol + '//' + location.hostname + ':4000'
        : 'http://127.0.0.1:4000')
  ).replace(/\/$/, '');

  let socketScriptLoading = null;
  let wakeTimer = null;

  function showWake(show) {
    const el = document.getElementById('apiWakeOverlay');
    if (!el) return;
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  function scheduleWake() {
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => showWake(true), 700);
  }

  function hideWake() {
    clearTimeout(wakeTimer);
    showWake(false);
  }

  function toast(msg) {
    const host = document.getElementById('toastHost');
    if (!host || !msg) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = msg;
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add('is-in'));
    setTimeout(() => {
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 400);
    }, 4200);
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(MENU_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const sections = parsed && parsed.payload && parsed.payload.sections;
      if (!Array.isArray(sections) || !sections.length) return null;
      const age = Date.now() - (parsed.at || 0);
      if (age > 14 * 864e5) return null;
      return parsed.payload;
    } catch (_) {
      return null;
    }
  }

  async function fetchJson(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchMenuWithRetry() {
    let lastErr = null;
    for (let i = 0; i < 5; i++) {
      try {
        // First tries are shorter; later allow Render cold start (~50s)
        const timeout = i === 0 ? 12000 : i < 3 ? 25000 : 55000;
        return await fetchJson(`${BASE}/api/menu`, timeout);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, Math.min(10000, 700 * Math.pow(2, i))));
      }
    }
    throw lastErr || new Error('menu fetch failed');
  }

  function apply(payload) {
    if (window.FriendlyMenu && typeof window.FriendlyMenu.applyLiveMenu === 'function') {
      window.FriendlyMenu.applyLiveMenu(payload);
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
      s.onerror = () => reject(new Error('socket.io load failed'));
      document.head.appendChild(s);
    });
    return socketScriptLoading;
  }

  function connectRealtime() {
    loadSocketIo()
      .then(() => {
        const socket = window.io(BASE, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 8,
          timeout: 20000,
        });
        socket.on('menu:changed', async () => {
          try {
            apply(await fetchJson(`${BASE}/api/menu`, 20000));
          } catch (e) {
            console.warn('[friendly-live] refresh failed', e);
          }
        });
      })
      .catch((e) => console.warn('[friendly-live] socket unavailable', e));
  }

  async function boot() {
    // Prefer cache immediately if API is slow / asleep
    const cached = readCache();
    if (cached) {
      try {
        apply(cached);
      } catch (e) {
        console.warn('[friendly-live] cache apply failed', e);
      }
    }

    scheduleWake();
    try {
      const payload = await fetchMenuWithRetry();
      const itemCount = Array.isArray(payload.sections)
        ? payload.sections.reduce((n, s) => n + ((s && s.items && s.items.length) || 0), 0)
        : 0;
      if (itemCount > 0) {
        apply(payload);
      } else if (!cached) {
        toast('Меню с сервера пустое — показано локальное');
      }
    } catch (e) {
      console.warn('[friendly-live] API unavailable', e && e.message ? e.message : e);
      if (cached) toast('Сервер недоступен — показано сохранённое меню');
      else toast('Сервер просыпается медленно — показано локальное меню');
    } finally {
      hideWake();
    }
    connectRealtime();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

