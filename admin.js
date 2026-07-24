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


/**
 * Standalone admin panel (admin.html)
 * Hardcoded gate: ilnur000 / 9987650
 * Data + saves go through the Friendly Menu API.
 */
(function () {
  const API = (
    window.FRIENDLY_API_BASE ||
    (typeof location !== 'undefined'
      ? location.protocol + '//' + location.hostname + ':4000'
      : 'http://127.0.0.1:4000')
  ).replace(/\/$/, '');
  const HARDCODED_LOGIN = 'ilnur000';
  const HARDCODED_PASSWORD = '9987650';
  const TOKEN_KEY = 'fm_admin_token';
  const AUTH_FLAG = 'fm_admin_ok';

  const state = {
    token: null,
    categories: [],
    items: [],
    categoryId: '',
    catQuery: '',
    itemQuery: '',
  };

  const els = {
    gate: document.getElementById('adminGate'),
    gateForm: document.getElementById('adminGateForm'),
    gateError: document.getElementById('adminGateError'),
    app: document.getElementById('adminApp'),
    logoutBtn: document.getElementById('adminLogoutBtn'),
    liveStatus: document.getElementById('adminLiveStatus'),
    categoryList: document.getElementById('categoryList'),
    catSearch: document.getElementById('catSearch'),
    itemSearch: document.getElementById('itemSearch'),
    itemsBody: document.getElementById('itemsBody'),
    itemsEmpty: document.getElementById('itemsEmpty'),
    itemCount: document.getElementById('itemCount'),
    currentCatTitle: document.getElementById('currentCatTitle'),
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editTitle: document.getElementById('editTitle'),
    editError: document.getElementById('editError'),
    editSaveBtn: document.getElementById('editSaveBtn'),
    editPreview: document.getElementById('editPreview'),
    editUpload: document.getElementById('editUpload'),
    editCategorySelect: document.getElementById('editCategorySelect'),
  };

  function imgSrc(path) {
    if (!path) return 'image/nono.png';
    if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path.startsWith('/') ? API + path : path;
    return path;
  }

  function showGateError(msg) {
    els.gateError.hidden = !msg;
    els.gateError.textContent = msg || '';
  }

  function setAuthed(ok) {
    els.gate.hidden = !!ok;
    els.app.hidden = !ok;
    if (ok) sessionStorage.setItem(AUTH_FLAG, '1');
    else {
      sessionStorage.removeItem(AUTH_FLAG);
      sessionStorage.removeItem(TOKEN_KEY);
      state.token = null;
    }
  }

  async function api(path, options = {}) {
    const headers = {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers,
      body:
        options.body && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
    return data;
  }

  async function loginToApi(login, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { login, password },
    });
    state.token = data.token || null;
    if (state.token) sessionStorage.setItem(TOKEN_KEY, state.token);
    return data;
  }

  function filteredCategories() {
    const q = state.catQuery.trim().toLowerCase();
    if (!q) return state.categories;
    return state.categories.filter((c) => c.title.toLowerCase().includes(q));
  }

  function filteredItems() {
    let list = state.items;
    if (state.categoryId) {
      list = list.filter((i) => i.categoryId === state.categoryId);
    }
    const q = state.itemQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderCategories() {
    const cats = filteredCategories();
    els.categoryList.innerHTML = cats
      .map((c) => {
        const count = state.items.filter((i) => i.categoryId === c.id).length;
        const active = state.categoryId === c.id ? ' is-active' : '';
        return `<button type="button" class="admin-cat${active}" data-cat-id="${c.id}">
          ${escapeHtml(c.title)} <span class="admin-cat__count">(${count})</span>
        </button>`;
      })
      .join('');

    // sync "all" button
    document.querySelectorAll('.admin-cats > .admin-cat[data-cat-id=""]').forEach((btn) => {
      btn.classList.toggle('is-active', !state.categoryId);
    });
  }

  function renderItems() {
    const items = filteredItems();
    const cat = state.categories.find((c) => c.id === state.categoryId);
    els.currentCatTitle.textContent = cat ? cat.title : 'Все блюда';
    els.itemCount.textContent = `${items.length} блюд`;

    els.itemsEmpty.hidden = items.length > 0;
    els.itemsBody.innerHTML = items
      .map((item) => {
        const stockOk = item.availability === 'IN_STOCK';
        return `<tr data-id="${item.id}">
          <td><img class="admin-thumb" src="${escapeAttr(imgSrc(item.imageUrl))}" alt="" /></td>
          <td>
            <div class="admin-dish">
              <div class="admin-dish__name">${escapeHtml(item.name)}</div>
              <div class="admin-dish__meta">${escapeHtml(item.weight || '')}${item.isActive ? '' : ' · скрыто'}</div>
            </div>
          </td>
          <td>${Number(item.price) || 0} тг</td>
          <td><span class="admin-badge ${stockOk ? 'admin-badge--ok' : 'admin-badge--off'}">${stockOk ? 'В наличии' : 'Нет'}</span></td>
          <td>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit="${item.id}">Изменить</button>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-toggle-stock="${item.id}">${stockOk ? 'Снять' : 'Вернуть'}</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderAll() {
    renderCategories();
    renderItems();
  }

  async function loadData() {
    const [cats, items] = await Promise.all([
      api('/api/admin/categories'),
      api('/api/admin/items'),
    ]);
    state.categories = cats.categories || [];
    state.items = items.items || [];
    fillCategorySelect();
    renderAll();
    els.liveStatus.textContent = 'API online';
    els.liveStatus.classList.remove('is-off');
  }

  function fillCategorySelect() {
    els.editCategorySelect.innerHTML = state.categories
      .map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`)
      .join('');
  }

  function openEdit(item) {
    els.editError.hidden = true;
    els.editTitle.textContent = `Редактировать: ${item.name}`;
    const f = els.editForm;
    f.id.value = item.id;
    f.name.value = item.name || '';
    f.categoryId.value = item.categoryId;
    f.price.value = item.price ?? 0;
    f.weight.value = item.weight || '';
    f.description.value = item.description || '';
    f.availability.value = item.availability || 'IN_STOCK';
    f.isActive.checked = item.isActive !== false;
    f.imageUrl.value = item.imageUrl || '';
    els.editPreview.src = imgSrc(item.imageUrl);
    els.editModal.hidden = false;
  }

  function closeEdit() {
    els.editModal.hidden = true;
    els.editForm.reset();
  }

  async function saveEdit(e) {
    e.preventDefault();
    const f = els.editForm;
    const id = f.id.value;
    const payload = {
      name: f.name.value.trim(),
      categoryId: f.categoryId.value,
      price: Number(f.price.value) || 0,
      weight: f.weight.value.trim(),
      description: f.description.value.trim(),
      availability: f.availability.value,
      isActive: f.isActive.checked,
      imageUrl: f.imageUrl.value.trim() || 'image/nono.png',
    };

    els.editSaveBtn.disabled = true;
    els.editError.hidden = true;
    try {
      const { item } = await api(`/api/admin/items/${id}`, { method: 'PATCH', body: payload });
      const idx = state.items.findIndex((x) => x.id === id);
      if (idx >= 0) state.items[idx] = item;
      else state.items.push(item);
      renderAll();
      closeEdit();
    } catch (err) {
      els.editError.hidden = false;
      els.editError.textContent = err.message || 'Ошибка сохранения';
    } finally {
      els.editSaveBtn.disabled = false;
    }
  }

  async function toggleStock(id) {
    const item = state.items.find((x) => x.id === id);
    if (!item) return;
    const availability = item.availability === 'IN_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK';
    const { item: updated } = await api(`/api/admin/items/${id}`, {
      method: 'PATCH',
      body: { availability },
    });
    Object.assign(item, updated);
    renderItems();
  }

  async function uploadImage(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const data = await api('/api/admin/upload', { method: 'POST', body: fd });
    els.editForm.imageUrl.value = data.imageUrl;
    els.editPreview.src = imgSrc(data.imageUrl);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  // ——— events ———
  els.gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showGateError('');
    const fd = new FormData(els.gateForm);
    const login = String(fd.get('login') || '').trim();
    const password = String(fd.get('password') || '');
    const submitBtn = els.gateForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Prefer real API auth (DB user). Hardcoded pair is the known default after bootstrap.
      await loginToApi(login, password);
      setAuthed(true);
      els.liveStatus.textContent = 'API online';
      els.liveStatus.classList.remove('is-off');
      await loadData();
    } catch (err) {
      const msg = String(err.message || err);
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        showGateError('API не запущен. В корне проекта выполните: npm run dev (порт 4000)');
      } else if (login === HARDCODED_LOGIN && password === HARDCODED_PASSWORD) {
        showGateError('API отклонил вход. Перезапустите: npm run dev (админ создаётся автоматически)');
      } else {
        showGateError(msg === 'Failed to fetch' ? 'API недоступен (npm run dev)' : (msg || 'Неверный логин или пароль'));
      }
      setAuthed(false);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
    } catch (_) {}
    setAuthed(false);
    els.gateForm.reset();
  });

  document.querySelector('.admin-cats').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat-id]');
    if (!btn) return;
    state.categoryId = btn.getAttribute('data-cat-id') || '';
    renderAll();
  });

  els.catSearch.addEventListener('input', () => {
    state.catQuery = els.catSearch.value;
    renderCategories();
  });

  els.itemSearch.addEventListener('input', () => {
    state.itemQuery = els.itemSearch.value;
    renderItems();
  });

  els.itemsBody.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
    if (editId) {
      const item = state.items.find((x) => x.id === editId);
      if (item) openEdit(item);
      return;
    }
    const stockId = e.target.closest('[data-toggle-stock]')?.getAttribute('data-toggle-stock');
    if (stockId) {
      try {
        await toggleStock(stockId);
      } catch (err) {
        alert(err.message || 'Не удалось обновить наличие');
      }
    }
  });

  els.editForm.addEventListener('submit', saveEdit);
  els.editModal.querySelectorAll('[data-close-edit]').forEach((el) => {
    el.addEventListener('click', closeEdit);
  });
  els.editUpload.addEventListener('change', async () => {
    try {
      await uploadImage(els.editUpload.files?.[0]);
    } catch (err) {
      els.editError.hidden = false;
      els.editError.textContent = err.message || 'Ошибка загрузки';
    }
  });
  els.editForm.imageUrl.addEventListener('input', () => {
    els.editPreview.src = imgSrc(els.editForm.imageUrl.value);
  });

  // restore session
  async function boot() {
    state.token = sessionStorage.getItem(TOKEN_KEY);
    const flagged = sessionStorage.getItem(AUTH_FLAG) === '1';
    if (!flagged || !state.token) {
      setAuthed(false);
      return;
    }
    try {
      await api('/api/auth/me');
      setAuthed(true);
      await loadData();
    } catch {
      setAuthed(false);
    }
  }

  boot();
})();

