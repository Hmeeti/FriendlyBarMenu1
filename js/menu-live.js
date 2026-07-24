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
