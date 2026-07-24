/**
 * Standalone admin panel (admin.html)
 * Data + saves go through the Friendly Menu API.
 */
window.FRIENDLY_CONFIG = window.FRIENDLY_CONFIG || {
  apiBase: 'https://friendlybarmenu1admin.onrender.com',
  adminUrl: '',
};

(function applyFriendlyConfig() {
  const cfg = window.FRIENDLY_CONFIG || {};
  if (cfg.apiBase) {
    window.FRIENDLY_API_BASE = String(cfg.apiBase).replace(/\/$/, '');
  } else if (!window.FRIENDLY_API_BASE) {
    window.FRIENDLY_API_BASE = 'https://friendlybarmenu1admin.onrender.com';
  }
  if (cfg.adminUrl) {
    window.FRIENDLY_ADMIN_URL = String(cfg.adminUrl).replace(/\/$/, '');
  }
})();

(function () {
  const API = (
    window.FRIENDLY_API_BASE ||
    (typeof location !== 'undefined'
      ? location.protocol + '//' + location.hostname + ':4000'
      : 'http://127.0.0.1:4000')
  ).replace(/\/$/, '');
  const TOKEN_KEY = 'fm_admin_token';
  const AUTH_FLAG = 'fm_admin_ok';

  const state = {
    token: null,
    user: null,
    tab: 'menu',
    categories: [],
    items: [],
    categoryId: '',
    catQuery: '',
    itemQuery: '',
    logs: [],
    logQuery: '',
    logAction: '',
    logTotal: 0,
  };

  const els = {
    gate: document.getElementById('adminGate'),
    gateForm: document.getElementById('adminGateForm'),
    gateError: document.getElementById('adminGateError'),
    app: document.getElementById('adminApp'),
    logoutBtn: document.getElementById('adminLogoutBtn'),
    liveStatus: document.getElementById('adminLiveStatus'),
    userLabel: document.getElementById('adminUserLabel'),
    menuView: document.getElementById('adminMenuView'),
    logsView: document.getElementById('adminLogsView'),
    analyticsView: document.getElementById('adminAnalyticsView'),
    logsTab: document.getElementById('adminLogsTab'),
    analyticsTab: document.getElementById('adminAnalyticsTab'),
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
    logsBody: document.getElementById('logsBody'),
    logsEmpty: document.getElementById('logsEmpty'),
    logSearch: document.getElementById('logSearch'),
    logActionFilter: document.getElementById('logActionFilter'),
    logRefreshBtn: document.getElementById('logRefreshBtn'),
    logCount: document.getElementById('logCount'),
    analyticsDays: document.getElementById('analyticsDays'),
    analyticsRefreshBtn: document.getElementById('analyticsRefreshBtn'),
    analyticsStats: document.getElementById('analyticsStats'),
    analyticsChart: document.getElementById('analyticsChart'),
    analyticsEmpty: document.getElementById('analyticsEmpty'),
  };

  function canViewLogs() {
    // Full-access admins (Hmeeti / SUPER_ADMIN) see the journal + analytics
    if (!state.user) return false;
    const u = String(state.user.username || '').toLowerCase();
    return u === 'hmeeti' || state.user.role === 'SUPER_ADMIN';
  }

  function formatDuration(sec) {
    const n = Math.max(0, Math.round(Number(sec) || 0));
    if (n < 60) return `${n} сек`;
    const m = Math.floor(n / 60);
    const s = n % 60;
    if (m < 60) return s ? `${m} мин ${s} сек` : `${m} мин`;
    const h = Math.floor(m / 60);
    return `${h} ч ${m % 60} мин`;
  }

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
      state.user = null;
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
    state.user = data.user || null;
    if (state.token) sessionStorage.setItem(TOKEN_KEY, state.token);
    return data;
  }

  function applyUserChrome() {
    const u = state.user;
    if (els.userLabel) {
      els.userLabel.textContent = u
        ? `${u.name || u.username} · ${u.role === 'SUPER_ADMIN' ? 'полный доступ' : 'менеджер'}`
        : 'Редактирование меню';
    }
    const showExtras = canViewLogs();
    if (els.logsTab) {
      if (showExtras) els.logsTab.removeAttribute('hidden');
      else els.logsTab.setAttribute('hidden', '');
    }
    if (els.analyticsTab) {
      if (showExtras) els.analyticsTab.removeAttribute('hidden');
      else els.analyticsTab.setAttribute('hidden', '');
    }
    if (!showExtras && (state.tab === 'logs' || state.tab === 'analytics')) setTab('menu');
  }

  function setTab(tab) {
    const allowed = new Set(['menu']);
    if (canViewLogs()) {
      allowed.add('logs');
      allowed.add('analytics');
    }
    state.tab = allowed.has(tab) ? tab : 'menu';
    document.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === state.tab);
    });
    if (els.menuView) {
      if (state.tab === 'menu') els.menuView.removeAttribute('hidden');
      else els.menuView.setAttribute('hidden', '');
    }
    if (els.logsView) {
      if (state.tab === 'logs') els.logsView.removeAttribute('hidden');
      else els.logsView.setAttribute('hidden', '');
    }
    if (els.analyticsView) {
      if (state.tab === 'analytics') els.analyticsView.removeAttribute('hidden');
      else els.analyticsView.setAttribute('hidden', '');
    }
    if (state.tab === 'logs') {
      if (els.logsEmpty) {
        els.logsEmpty.hidden = false;
        els.logsEmpty.textContent = 'Загрузка логов…';
      }
      if (els.logsBody) els.logsBody.innerHTML = '';
      loadLogs().catch((e) => {
        if (els.logsEmpty) {
          els.logsEmpty.hidden = false;
          els.logsEmpty.textContent = e.message || 'Не удалось загрузить логи';
        }
        if (els.logCount) els.logCount.textContent = 'ошибка';
      });
    }
    if (state.tab === 'analytics') {
      loadAnalytics().catch((e) => {
        if (els.analyticsEmpty) {
          els.analyticsEmpty.hidden = false;
          els.analyticsEmpty.textContent = e.message || 'Не удалось загрузить аналитику';
        }
        if (els.analyticsStats) els.analyticsStats.innerHTML = '';
        if (els.analyticsChart) els.analyticsChart.innerHTML = '';
      });
    }
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

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso || '';
    }
  }

  function renderLogs() {
    const logs = state.logs || [];
    els.logCount.textContent = `${state.logTotal || logs.length} записей`;
    els.logsEmpty.hidden = logs.length > 0;
    els.logsBody.innerHTML = logs
      .map(
        (log) => `<tr>
          <td class="admin-log-time">${escapeHtml(formatTime(log.createdAt))}</td>
          <td>${escapeHtml(log.adminName || log.adminEmail || '—')}</td>
          <td><span class="admin-badge admin-badge--log">${escapeHtml(log.action)}</span></td>
          <td>${escapeHtml([log.entityType, log.entityLabel].filter(Boolean).join(' · ') || '—')}</td>
          <td class="admin-log-summary">${escapeHtml(log.summary || '')}</td>
        </tr>`
      )
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

  async function loadLogs() {
    if (!canViewLogs()) throw new Error('Нет доступа к журналу. Войдите как Hmeeti.');
    const params = new URLSearchParams({ limit: '100', page: '1' });
    if (state.logQuery.trim()) params.set('q', state.logQuery.trim());
    if (state.logAction) params.set('action', state.logAction);
    const data = await api(`/api/admin/audit?${params}`);
    state.logs = data.logs || [];
    state.logTotal = data.total || state.logs.length;
    renderLogs();
    if (!state.logs.length && els.logsEmpty) {
      els.logsEmpty.hidden = false;
      els.logsEmpty.textContent = 'Пока нет записей в журнале.';
    }
  }

  async function loadAnalytics() {
    if (!canViewLogs()) throw new Error('Нет доступа к аналитике. Войдите как Hmeeti.');
    const days = Number(els.analyticsDays?.value || 30);
    const data = await api(`/api/admin/analytics?days=${days}`);
    const p = data.period || {};
    els.analyticsStats.innerHTML = `
      <div class="admin-stat card-panel"><span class="admin-stat__label">Сегодня</span><strong class="admin-stat__value">${data.today ?? 0}</strong><span class="admin-stat__hint">заходов</span></div>
      <div class="admin-stat card-panel"><span class="admin-stat__label">За ${days} дн.</span><strong class="admin-stat__value">${p.visits ?? 0}</strong><span class="admin-stat__hint">заходов</span></div>
      <div class="admin-stat card-panel"><span class="admin-stat__label">Среднее время</span><strong class="admin-stat__value">${escapeHtml(formatDuration(p.avgSec))}</strong><span class="admin-stat__hint">на сессию</span></div>
      <div class="admin-stat card-panel"><span class="admin-stat__label">Активные</span><strong class="admin-stat__value">${escapeHtml(formatDuration(p.avgEngagedSec))}</strong><span class="admin-stat__hint">≥10 сек · ${p.engaged ?? 0} сессий</span></div>
      <div class="admin-stat card-panel"><span class="admin-stat__label">Всего</span><strong class="admin-stat__value">${data.allTime ?? 0}</strong><span class="admin-stat__hint">за всё время</span></div>
    `;

    const byDay = data.byDay || [];
    const max = Math.max(1, ...byDay.map((d) => d.visits || 0));
    const hasAny = byDay.some((d) => d.visits > 0);
    if (els.analyticsEmpty) {
      els.analyticsEmpty.hidden = hasAny;
      if (!hasAny) els.analyticsEmpty.textContent = 'Пока нет данных. Откройте гостевое меню — сессии появятся здесь.';
    }
    els.analyticsChart.innerHTML = byDay
      .map((d) => {
        const h = Math.round(((d.visits || 0) / max) * 100);
        const label = String(d.day || '').slice(5);
        return `<div class="admin-chart__col" title="${escapeHtml(d.day)}: ${d.visits} · ср. ${formatDuration(d.avgSec)}">
          <div class="admin-chart__bar" style="height:${h}%"></div>
          <span class="admin-chart__n">${d.visits || 0}</span>
          <span class="admin-chart__day">${escapeHtml(label)}</span>
        </div>`;
      })
      .join('');
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

  els.gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showGateError('');
    const fd = new FormData(els.gateForm);
    const login = String(fd.get('login') || '').trim();
    const password = String(fd.get('password') || '');
    const submitBtn = els.gateForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await loginToApi(login, password);
      setAuthed(true);
      applyUserChrome();
      setTab('menu');
      els.liveStatus.textContent = 'API online';
      els.liveStatus.classList.remove('is-off');
      await loadData();
    } catch (err) {
      const msg = String(err.message || err);
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        showGateError('API не запущен или недоступен (Render / npm run dev)');
      } else {
        showGateError(msg === 'Failed to fetch' ? 'API недоступен' : (msg || 'Неверный логин или пароль'));
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

  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.getAttribute('data-tab')));
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

  let logTimer = null;
  function scheduleLogs() {
    clearTimeout(logTimer);
    logTimer = setTimeout(() => {
      loadLogs().catch((err) => console.warn(err));
    }, 250);
  }
  els.logSearch?.addEventListener('input', () => {
    state.logQuery = els.logSearch.value;
    scheduleLogs();
  });
  els.logActionFilter?.addEventListener('change', () => {
    state.logAction = els.logActionFilter.value;
    scheduleLogs();
  });
  els.logRefreshBtn?.addEventListener('click', () => {
    loadLogs().catch((err) => alert(err.message || 'Ошибка'));
  });

  els.analyticsRefreshBtn?.addEventListener('click', () => {
    loadAnalytics().catch((err) => alert(err.message || 'Ошибка'));
  });
  els.analyticsDays?.addEventListener('change', () => {
    if (state.tab === 'analytics') {
      loadAnalytics().catch((err) => console.warn(err));
    }
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

  async function boot() {
    state.token = sessionStorage.getItem(TOKEN_KEY);
    const flagged = sessionStorage.getItem(AUTH_FLAG) === '1';
    if (!flagged || !state.token) {
      setAuthed(false);
      return;
    }
    try {
      const me = await api('/api/auth/me');
      state.user = me.user || null;
      setAuthed(true);
      applyUserChrome();
      setTab('menu');
      await loadData();
    } catch {
      setAuthed(false);
    }
  }

  boot();
})();
