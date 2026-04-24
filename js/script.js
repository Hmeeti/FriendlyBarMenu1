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
        const id = Number(idStr);
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

function renderMenu() {
    const root = document.getElementById('menu-root');
    if (!root || !window.MENU_SECTIONS) return;

    const html = window.MENU_SECTIONS.map((section) => {
        const idAttr = section.anchor ? ` id="${escapeHtml(section.anchor)}"` : '';
        const title = escapeHtml(section.title);
        if (!section.items || section.items.length === 0) {
            return `<h2 class="title__menu"${idAttr}>${title}</h2>`;
        }
        const itemsHtml = section.items.map(renderMenuItemCard).join('');
        return `<h2 class="title__menu"${idAttr}>${title}</h2><div class="menu-grid">${itemsHtml}</div>`;
    }).join('');

    root.innerHTML = html;
    bindMenuImageFallbacks();
}

function renderMenuItemCard(it) {
    const id = Number(it.id);
    const name = escapeHtml(it.name);
    const weight = it.weight ? `<div class="item-weight">${escapeHtml(it.weight)}</div>` : '';
    const priceDisp = escapeHtml(it.priceDisplay || '');
    const imgPath = it.img ? imgSrcForPage(it.img) : '';
    const imgBlock = imgPath
        ? `<div class="item-image-wrap"><img src="${imgPath}" alt="" class="item-image" loading="lazy" width="400" height="280" decoding="async"></div>`
        : '';
    const itemClass = imgPath ? 'menu-item' : 'menu-item menu-item--no-image';
    return `
        <div class="${itemClass}" data-item-id="${id}" role="button" tabindex="0">
            ${imgBlock}
            <div class="item-content">
                <div class="item-name">${name}</div>
                ${weight}
                <div class="item-footer">
                    <div class="item-price">${priceDisp}</div>
                    <button type="button" class="add-btn" data-add="${id}" aria-label="Добавить в заказ">+</button>
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
    const id = Number(itemId);
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
    //document.getElementById('modalDescription').textContent = item.desc || 'Состав уточняйте у персонала.';
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

function initCategoryNav() {
    document.querySelectorAll('.category').forEach((btn) => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.category').forEach((b) => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
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

    initCategoryNav();
    initSearch();
    initThemeToggle();
    initModalImageFallback();
    updateCart();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
