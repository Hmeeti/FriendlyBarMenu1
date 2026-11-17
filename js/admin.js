/**
 * Friendly admin panel — no server. The menu lives in menu.json in the GitHub repository;
 * each save is a commit made with the admin's GitHub token, and the Pages workflow
 * republishes the site (1–2 minutes). The token never leaves this browser except to api.github.com.
 */
(function (root) {
  'use strict';

  /* ================= core: menu edits (pure, also used by tests) ================= */

  const FIELD_ORDER = ['id', 'name', 'price', 'fullName', 'desc', 'weight', 'img', 'oos', 'hidden'];
  const NO_PHOTO = /(^|\/)nono\.png$/i;

  const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  function sectionOf(menu, title) {
    const sec = (menu.sections || []).find((s) => s.title === title);
    if (!sec) throw new Error(`Категория «${title}» не найдена — обновите страницу`);
    if (!Array.isArray(sec.items)) sec.items = [];
    return sec;
  }

  /** Put known fields first, keep anything else the file already had. */
  function ordered(item) {
    const out = {};
    for (const k of FIELD_ORDER) if (item[k] !== undefined) out[k] = item[k];
    for (const k of Object.keys(item)) if (!(k in out) && item[k] !== undefined) out[k] = item[k];
    return out;
  }

  /** Form fields → menu.json fields; empty values are removed so the file stays small. */
  function applyFields(item, f) {
    if ('name' in f) item.name = clean(f.name, 120);
    if ('price' in f) item.price = Math.max(0, Math.round(Number(f.price) || 0));
    for (const [k, max] of [['fullName', 160], ['desc', 600], ['weight', 40]]) {
      if (!(k in f)) continue;
      let v = clean(f[k], max);
      // "тесто,сыр" → "тесто, сыр": without spaces long lists cannot wrap on phones
      if (k === 'desc') v = v.replace(/\s*,\s*/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '');
      item[k] = v && !(k === 'fullName' && v === item.name) ? v : undefined;
    }
    if ('img' in f) {
      const v = clean(f.img, 200).replace(/^\.?\//, '');
      item.img = v && !NO_PHOTO.test(v) ? v : undefined;
    }
    if ('oos' in f) item.oos = f.oos ? true : undefined;
    if ('hidden' in f) item.hidden = f.hidden ? true : undefined;
    return item;
  }

  function nextId(menu) {
    let max = 0;
    for (const s of menu.sections || []) for (const it of s.items || []) if (Number(it.id) > max) max = Number(it.id);
    return max + 1;
  }

  function findItem(menu, id, title) {
    const sec = sectionOf(menu, title);
    const idx = sec.items.findIndex((it) => String(it.id) === String(id));
    if (idx < 0) throw new Error('Блюдо уже удалили или переместили — обновите страницу');
    return { sec, idx, item: sec.items[idx] };
  }

  const ops = {
    /** Same dish can be listed in several categories (same id): field edits apply to every copy. */
    update(menu, { id, section, toSection, fields }) {
      const { sec, idx, item } = findItem(menu, id, section);
      const before = { ...item };
      for (const s of menu.sections || []) {
        (s.items || []).forEach((it, i) => {
          if (String(it.id) === String(id)) s.items[i] = ordered(applyFields({ ...it }, fields));
        });
      }
      const after = sec.items[idx];
      if (toSection && toSection !== section) {
        const target = sectionOf(menu, toSection);
        sec.items.splice(idx, 1);
        if (!target.items.some((it) => String(it.id) === String(id))) target.items.push(after);
      }
      return { before, after };
    },
    create(menu, { section, fields }) {
      const sec = sectionOf(menu, section);
      const item = ordered(applyFields({ id: nextId(menu), name: '', price: 0 }, fields));
      sec.items.push(item);
      return { before: null, after: item };
    },
    remove(menu, { id, section }) {
      const { sec, idx, item } = findItem(menu, id, section);
      sec.items.splice(idx, 1);
      return { before: item, after: null };
    },
  };

  function describe(op, args, res) {
    const name = (res.after || res.before || {}).name || 'блюдо';
    if (op === 'create') return `Меню: новое блюдо «${name}» в «${args.section}»`;
    if (op === 'remove') return `Меню: удалено «${name}» из «${args.section}»`;
    const a = res.before;
    const b = res.after;
    const parts = [];
    if (a.name !== b.name) parts.push(`название «${a.name}» → «${b.name}»`);
    if (a.price !== b.price) parts.push(`цена ${a.price} → ${b.price}`);
    if (!a.oos !== !b.oos) parts.push(b.oos ? 'нет в наличии' : 'снова в наличии');
    if (!a.hidden !== !b.hidden) parts.push(b.hidden ? 'скрыто' : 'снова показано');
    if (args.toSection && args.toSection !== args.section) parts.push(`перенесено в «${args.toSection}»`);
    if ((a.desc || '') !== (b.desc || '')) parts.push('описание');
    if ((a.weight || '') !== (b.weight || '')) parts.push('вес');
    if ((a.img || '') !== (b.img || '')) parts.push('фото');
    if ((a.fullName || '') !== (b.fullName || '')) parts.push('полное название');
    return `Меню: ${b.name} — ${parts.join(', ') || 'без изменений'}`;
  }

  /* ================= core: GitHub API ================= */

  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  class GitHubError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  function humanError(status, message) {
    if (status === 401) return 'Ключ неверный или просрочен. Выйдите и войдите с новым ключом.';
    if (status === 403 && /rate limit/i.test(message)) return 'GitHub временно ограничил запросы. Подождите минуту.';
    if (status === 403) return 'У ключа нет права записи. Нужно разрешение Contents — Read and write.';
    if (status === 404) return 'Нет доступа к репозиторию. Проверьте, что ключ выдан на репозиторий меню.';
    return message || `Ошибка GitHub (${status})`;
  }

  function createClient({ repo, branch, menuPath }, token, fetchImpl) {
    const doFetch = fetchImpl || ((...a) => fetch(...a));
    const base = `https://api.github.com/repos/${repo}`;
    const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

    async function gh(path, { method = 'GET', body } = {}) {
      let res;
      try {
        res = await doFetch(path.startsWith('http') ? path : base + path, {
          method,
          cache: 'no-store',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (_) {
        throw new GitHubError(0, 'Нет связи с GitHub. Проверьте интернет.');
      }
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok) throw new GitHubError(res.status, humanError(res.status, data && data.message));
      return data;
    }

    async function readText(path) {
      const data = await gh(`/contents/${encPath(path)}?ref=${encodeURIComponent(branch)}`);
      return { text: fromBase64(data.content), sha: data.sha };
    }

    async function putFile(path, base64, message, sha) {
      const data = await gh(`/contents/${encPath(path)}`, {
        method: 'PUT',
        body: { message, content: base64, branch, ...(sha ? { sha } : {}) },
      });
      return data.commit.sha;
    }

    return {
      async whoami() {
        const info = await gh('');
        if (info.permissions && info.permissions.push === false) {
          throw new GitHubError(403, 'У этого аккаунта нет права записи в репозиторий меню.');
        }
        let login = '';
        try {
          login = (await gh('https://api.github.com/user')).login || '';
        } catch (_) {}
        return { login, repo: info.full_name };
      },

      async readMenu() {
        const { text, sha } = await readText(menuPath);
        return { menu: JSON.parse(text), sha, indent: (/\n( +)"/.exec(text) || [, '  '])[1].length };
      },

      /** Re-read the latest menu, apply the edit and commit; retries if someone saved in between. */
      async editMenu(op, args) {
        for (let attempt = 0; ; attempt++) {
          const { menu, sha, indent } = await this.readMenu();
          const res = ops[op](menu, args);
          menu.updatedAt = new Date().toISOString();
          const message = describe(op, args, res);
          const text = `${JSON.stringify(menu, null, indent)}\n`;
          try {
            const commit = await putFile(menuPath, toBase64(new TextEncoder().encode(text)), message, sha);
            return { menu, commit, message, result: res };
          } catch (err) {
            if ((err.status === 409 || err.status === 422) && attempt < 3) continue;
            throw err;
          }
        }
      },

      async uploadImage(path, bytes, message) {
        return putFile(path, toBase64(bytes), message);
      },

      async history(limit = 60) {
        const list = await gh(`/commits?path=${encodeURIComponent(menuPath)}&sha=${encodeURIComponent(branch)}&per_page=${limit}`);
        return list.map((c) => ({
          sha: c.sha,
          url: c.html_url,
          date: c.commit.author.date,
          who: (c.author && c.author.login) || c.commit.author.name,
          message: c.commit.message.split('\n')[0],
        }));
      },

      /** Pages build for a commit: 'pending' | 'success' | 'failure' | 'cancelled' | 'unknown'. */
      async deployState(commit) {
        const data = await gh(`/actions/runs?head_sha=${commit}&per_page=5`);
        const run = (data.workflow_runs || [])[0];
        if (!run) return 'pending';
        if (run.status !== 'completed') return 'pending';
        if (run.conclusion === 'success') return 'success';
        if (run.conclusion === 'cancelled') return 'cancelled';
        return 'failure';
      },
    };
  }

  root.FriendlyAdminCore = { ops, describe, createClient, toBase64, fromBase64 };
  if (typeof document === 'undefined') return;

  /* ================= UI ================= */

  const CFG = window.FRIENDLY_CONFIG || {};
  const TOKEN_KEY = 'fm_gh_token';
  const $ = (id) => document.getElementById(id);
  const els = {
    gate: $('adminGate'),
    gateForm: $('adminGateForm'),
    gateError: $('adminGateError'),
    app: $('adminApp'),
    logoutBtn: $('adminLogoutBtn'),
    status: $('adminLiveStatus'),
    userLabel: $('adminUserLabel'),
    menuView: $('adminMenuView'),
    logsView: $('adminLogsView'),
    categoryList: $('categoryList'),
    catSearch: $('catSearch'),
    itemSearch: $('itemSearch'),
    itemsBody: $('itemsBody'),
    itemsEmpty: $('itemsEmpty'),
    itemCount: $('itemCount'),
    currentCatTitle: $('currentCatTitle'),
    addItemBtn: $('addItemBtn'),
    editModal: $('editModal'),
    editForm: $('editForm'),
    editEyebrow: $('editEyebrow'),
    editTitle: $('editTitle'),
    editError: $('editError'),
    editSaveBtn: $('editSaveBtn'),
    editDeleteBtn: $('editDeleteBtn'),
    editPreview: $('editPreview'),
    editUpload: $('editUpload'),
    editCategorySelect: $('editCategorySelect'),
    logsBody: $('logsBody'),
    logsEmpty: $('logsEmpty'),
    logSearch: $('logSearch'),
    logRefreshBtn: $('logRefreshBtn'),
    logCount: $('logCount'),
    toast: $('adminToast'),
  };

  const state = {
    client: null,
    menu: null,
    tab: 'menu',
    section: '',
    catQuery: '',
    itemQuery: '',
    editing: null, // { id, section } or { section, isNew: true }
    logs: [],
    logQuery: '',
    localImages: new Map(), // freshly uploaded path → blob URL (not on the site until the next build)
    deployToken: 0,
    busy: false,
  };

  const store = {
    get() {
      try {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
      } catch (_) {
        return '';
      }
    },
    set(token, remember) {
      try {
        (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
      } catch (_) {}
    },
    clear() {
      try {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
    },
  };

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let toastTimer = 0;
  function toast(msg, isError) {
    clearTimeout(toastTimer);
    els.toast.textContent = msg;
    els.toast.classList.toggle('is-error', Boolean(isError));
    els.toast.hidden = false;
    toastTimer = setTimeout(() => (els.toast.hidden = true), isError ? 7000 : 3500);
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle('is-busy', kind === 'busy');
    els.status.classList.toggle('is-off', kind === 'off');
  }

  /* ---------- images ---------- */

  function originalSrc(path) {
    const p = String(path || '').trim();
    if (!p) return 'image/nono.png';
    if (state.localImages.has(p)) return state.localImages.get(p);
    return p;
  }

  function thumbSrc(path) {
    const p = String(path || '').trim();
    if (state.localImages.has(p)) return state.localImages.get(p);
    if (/^image\//i.test(p) && !/^image\/opt\//i.test(p) && /\.(png|jpe?g|webp)$/i.test(p)) {
      return p.replace(/^image\//i, 'image/opt/').replace(/\.(png|jpe?g|webp)$/i, '-400.webp');
    }
    return originalSrc(p);
  }

  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallback === 'done') return;
      const orig = img.dataset.orig;
      if (orig && img.getAttribute('src') !== orig) img.src = orig;
      else {
        img.dataset.fallback = 'done';
        img.src = 'image/nono.png';
      }
    },
    true,
  );

  /** Shrink phone photos before upload: max 1600 px JPEG keeps the repository light. */
  async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Не удалось открыть фото. Попробуйте JPG или PNG.'));
        i.src = url;
      });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Не удалось сжать фото');
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- data ---------- */

  const sections = () => (state.menu ? state.menu.sections || [] : []);

  function rows() {
    const q = state.itemQuery.trim().toLowerCase();
    const seen = new Set();
    const out = [];
    for (const sec of sections()) {
      if (state.section && sec.title !== state.section) continue;
      for (const item of sec.items || []) {
        // In "all dishes" a dish listed in two categories is shown once.
        if (!state.section) {
          if (seen.has(String(item.id))) continue;
          seen.add(String(item.id));
        }
        if (q && !`${item.name} ${item.fullName || ''} ${item.desc || ''}`.toLowerCase().includes(q)) continue;
        out.push({ item, section: sec.title });
      }
    }
    return out;
  }

  /* ---------- render ---------- */

  function renderCategories() {
    const q = state.catQuery.trim().toLowerCase();
    els.categoryList.innerHTML = sections()
      .filter((s) => !q || s.title.toLowerCase().includes(q))
      .map((s) => {
        const active = state.section === s.title ? ' is-active' : '';
        return `<button type="button" class="admin-cat${active}" data-cat-id="${escapeHtml(s.title)}">${escapeHtml(s.title)} <span class="admin-cat__count">(${(s.items || []).length})</span></button>`;
      })
      .join('');
    document.querySelector('.admin-cats > .admin-cat[data-cat-id=""]').classList.toggle('is-active', !state.section);
  }

  function renderItems() {
    const list = rows();
    els.currentCatTitle.textContent = state.section || 'Все блюда';
    els.itemCount.textContent = `${list.length} блюд`;
    els.itemsEmpty.hidden = list.length > 0;
    els.itemsBody.innerHTML = list
      .map(({ item, section }) => {
        const inStock = !item.oos;
        const key = `data-id="${escapeHtml(item.id)}" data-section="${escapeHtml(section)}"`;
        return `<tr>
          <td><img class="admin-thumb" src="${escapeHtml(thumbSrc(item.img))}" data-orig="${escapeHtml(originalSrc(item.img))}" alt="" loading="lazy" decoding="async" width="56" height="56" /></td>
          <td>
            <div class="admin-dish">
              <div class="admin-dish__name">${escapeHtml(item.name)}</div>
              <div class="admin-dish__meta">${escapeHtml([item.weight, !state.section ? section : '', item.hidden ? 'скрыто' : ''].filter(Boolean).join(' · '))}</div>
            </div>
          </td>
          <td>${Number(item.price) || 0} тг</td>
          <td><span class="admin-badge ${inStock ? 'admin-badge--ok' : 'admin-badge--off'}">${inStock ? 'В наличии' : 'Нет'}</span></td>
          <td>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit ${key}>Изменить</button>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-toggle-stock ${key}>${inStock ? 'Снять' : 'Вернуть'}</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderAll() {
    renderCategories();
    renderItems();
  }

  function renderLogs() {
    const q = state.logQuery.trim().toLowerCase();
    const list = state.logs.filter((l) => !q || `${l.message} ${l.who}`.toLowerCase().includes(q));
    els.logCount.textContent = `${list.length} записей`;
    els.logsEmpty.hidden = list.length > 0;
    els.logsBody.innerHTML = list
      .map(
        (l) => `<tr>
          <td class="admin-log-time">${escapeHtml(new Date(l.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td>
          <td>${escapeHtml(l.who)}</td>
          <td class="admin-log-summary"><a class="admin-log-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.message)}</a></td>
        </tr>`,
      )
      .join('');
  }

  function setTab(tab) {
    state.tab = tab === 'logs' ? 'logs' : 'menu';
    document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === state.tab));
    els.menuView.hidden = state.tab !== 'menu';
    els.logsView.hidden = state.tab !== 'logs';
    if (state.tab === 'logs') loadLogs();
  }

  /* ---------- actions ---------- */

  async function loadMenu() {
    setStatus('Загрузка…', 'busy');
    const { menu } = await state.client.readMenu();
    state.menu = menu;
    if (state.section && !sections().some((s) => s.title === state.section)) state.section = '';
    fillCategorySelect();
    renderAll();
    setStatus('Готово');
  }

  async function loadLogs() {
    els.logsEmpty.hidden = false;
    els.logsEmpty.textContent = 'Загрузка журнала…';
    els.logsBody.innerHTML = '';
    try {
      state.logs = await state.client.history();
      renderLogs();
      els.logsEmpty.textContent = 'Пока нет записей.';
    } catch (err) {
      els.logsEmpty.textContent = err.message;
    }
  }

  /** After a commit: follow the Pages build so the admin knows when guests see the change. */
  async function followDeploy(commit) {
    const token = ++state.deployToken;
    setStatus('Публикуется…', 'busy');
    const started = Date.now();
    while (token === state.deployToken && Date.now() - started < 8 * 60e3) {
      await new Promise((r) => setTimeout(r, 6000));
      if (token !== state.deployToken) return;
      let result;
      try {
        result = await state.client.deployState(commit);
      } catch (_) {
        setStatus('Сохранено · на сайте через ~2 мин');
        return;
      }
      if (result === 'success') return setStatus('На сайте ✓');
      if (result === 'cancelled') return setStatus('Сохранено');
      if (result === 'failure') {
        setStatus('Ошибка публикации', 'off');
        toast('Сохранено, но сборка сайта не прошла. Откройте вкладку Actions в GitHub.', true);
        return;
      }
    }
    if (token === state.deployToken) setStatus('Сохранено · на сайте через ~2 мин');
  }

  async function commitEdit(op, args) {
    if (state.busy) throw new Error('Подождите, предыдущее сохранение ещё идёт');
    state.busy = true;
    setStatus('Сохранение…', 'busy');
    try {
      const res = await state.client.editMenu(op, args);
      state.menu = res.menu;
      fillCategorySelect();
      renderAll();
      toast(`${res.message.replace(/^Меню: /, '')} — сохранено`);
      followDeploy(res.commit);
      return res;
    } catch (err) {
      setStatus('Не сохранено', 'off');
      throw err;
    } finally {
      state.busy = false;
    }
  }

  function fillCategorySelect() {
    els.editCategorySelect.innerHTML = sections()
      .map((s) => `<option value="${escapeHtml(s.title)}">${escapeHtml(s.title)}</option>`)
      .join('');
  }

  function openEdit(item, section) {
    const f = els.editForm;
    const isNew = !item;
    state.editing = isNew ? { section, isNew } : { id: item.id, section };
    item = item || {};
    els.editError.hidden = true;
    els.editEyebrow.textContent = isNew ? 'Новое блюдо' : 'Редактирование';
    els.editTitle.textContent = isNew ? 'Новое блюдо' : item.name;
    els.editDeleteBtn.hidden = isNew;
    f.name.value = item.name || '';
    f.fullName.value = item.fullName || '';
    f.section.value = section;
    f.price.value = item.price ?? '';
    f.weight.value = item.weight || '';
    f.desc.value = item.desc || '';
    f.availability.value = item.oos ? 'OUT_OF_STOCK' : 'IN_STOCK';
    f.visible.checked = !item.hidden;
    f.img.value = item.img || '';
    previewImage();
    els.editModal.hidden = false;
    f.name.focus();
  }

  function previewImage() {
    const p = els.editForm.img.value.trim();
    els.editPreview.dataset.fallback = '';
    els.editPreview.dataset.orig = originalSrc(p);
    els.editPreview.src = thumbSrc(p);
  }

  function closeEdit() {
    els.editModal.hidden = true;
    state.editing = null;
    els.editUpload.value = '';
  }

  function formFields() {
    const f = els.editForm;
    return {
      name: f.name.value,
      fullName: f.fullName.value,
      price: f.price.value,
      weight: f.weight.value,
      desc: f.desc.value,
      img: f.img.value,
      oos: f.availability.value === 'OUT_OF_STOCK',
      hidden: !f.visible.checked,
    };
  }

  function showEditError(err) {
    els.editError.hidden = false;
    els.editError.textContent = err.message || String(err);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const ed = state.editing;
    if (!ed) return;
    els.editSaveBtn.disabled = true;
    els.editError.hidden = true;
    try {
      const fields = formFields();
      const toSection = els.editForm.section.value;
      if (ed.isNew) await commitEdit('create', { section: toSection, fields });
      else await commitEdit('update', { id: ed.id, section: ed.section, toSection, fields });
      closeEdit();
    } catch (err) {
      showEditError(err);
    } finally {
      els.editSaveBtn.disabled = false;
    }
  }

  async function deleteItem() {
    const ed = state.editing;
    if (!ed || ed.isNew) return;
    if (!confirm(`Удалить «${els.editForm.name.value}» из «${ed.section}»?`)) return;
    els.editDeleteBtn.disabled = true;
    try {
      await commitEdit('remove', { id: ed.id, section: ed.section });
      closeEdit();
    } catch (err) {
      showEditError(err);
    } finally {
      els.editDeleteBtn.disabled = false;
    }
  }

  async function uploadImage(file) {
    if (!file) return;
    const label = els.editUpload.closest('label');
    label.classList.add('is-busy');
    els.editSaveBtn.disabled = true;
    els.editError.hidden = true;
    setStatus('Загрузка фото…', 'busy');
    try {
      const blob = await prepareImage(file);
      const stamp = new Date().toISOString().slice(0, 10);
      const path = `${CFG.uploadDir || 'image/admin'}/${stamp}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await state.client.uploadImage(path, bytes, `Фото: ${els.editForm.name.value.trim() || 'блюдо'}`);
      state.localImages.set(path, URL.createObjectURL(blob));
      els.editForm.img.value = path;
      previewImage();
      setStatus('Фото загружено — нажмите «Сохранить»');
    } catch (err) {
      setStatus('Фото не загружено', 'off');
      showEditError(err);
    } finally {
      label.classList.remove('is-busy');
      els.editSaveBtn.disabled = false;
      els.editUpload.value = '';
    }
  }

  async function toggleStock(id, section) {
    const sec = sections().find((s) => s.title === section);
    const item = sec && sec.items.find((it) => String(it.id) === String(id));
    if (!item) return;
    try {
      await commitEdit('update', { id, section, fields: { oos: !item.oos } });
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------- auth ---------- */

  async function signIn(token) {
    const client = createClient(CFG, token);
    const me = await client.whoami();
    state.client = client;
    els.userLabel.textContent = me.login ? `${me.login} · ${me.repo}` : me.repo;
    els.gate.hidden = true;
    els.app.hidden = false;
    setTab('menu');
    await loadMenu();
  }

  function signOut() {
    store.clear();
    state.client = null;
    state.menu = null;
    state.deployToken++;
    els.app.hidden = true;
    els.gate.hidden = false;
    els.gateForm.reset();
  }

  /* ---------- events ---------- */

  els.gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = els.gateForm.querySelector('[type="submit"]');
    const token = els.gateForm.token.value.trim();
    els.gateError.hidden = true;
    btn.disabled = true;
    try {
      await signIn(token);
      store.set(token, els.gateForm.remember.checked);
    } catch (err) {
      els.app.hidden = true;
      els.gate.hidden = false;
      els.gateError.hidden = false;
      els.gateError.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener('click', signOut);

  document.querySelectorAll('.admin-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  document.querySelector('.admin-cats').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat-id]');
    if (!btn) return;
    state.section = btn.dataset.catId || '';
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

  els.addItemBtn.addEventListener('click', () => {
    const first = sections()[0];
    if (first) openEdit(null, state.section || first.title);
  });

  els.itemsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const { id, section } = btn.dataset;
    if (btn.hasAttribute('data-edit')) {
      const sec = sections().find((s) => s.title === section);
      const item = sec && sec.items.find((it) => String(it.id) === id);
      if (item) openEdit(item, section);
    } else if (btn.hasAttribute('data-toggle-stock')) {
      btn.disabled = true;
      toggleStock(id, section).finally(() => (btn.disabled = false));
    }
  });

  els.editForm.addEventListener('submit', saveEdit);
  els.editDeleteBtn.addEventListener('click', deleteItem);
  els.editModal.querySelectorAll('[data-close-edit]').forEach((el) => el.addEventListener('click', closeEdit));
  els.editUpload.addEventListener('change', () => uploadImage(els.editUpload.files && els.editUpload.files[0]));
  els.editForm.img.addEventListener('change', previewImage);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.editModal.hidden) closeEdit();
  });

  els.logSearch.addEventListener('input', () => {
    state.logQuery = els.logSearch.value;
    renderLogs();
  });
  els.logRefreshBtn.addEventListener('click', loadLogs);

  window.addEventListener('beforeunload', (e) => {
    if (state.busy) e.preventDefault();
  });

  /* ---------- boot ---------- */

  const repoName = $('repoName');
  if (repoName && CFG.repo) repoName.textContent = CFG.repo;

  const saved = store.get();
  if (saved) {
    signIn(saved).catch((err) => {
      if (err.status === 401) store.clear();
      els.app.hidden = true;
      els.gate.hidden = false;
      els.gateError.hidden = false;
      els.gateError.textContent = err.message;
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
