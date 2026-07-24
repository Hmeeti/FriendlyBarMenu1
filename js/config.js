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
