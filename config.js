/**
 * API endpoint (Render).
 * Local Live Server can still override:
 *   window.FRIENDLY_CONFIG = { apiBase: 'http://127.0.0.1:4000' };
 */
window.FRIENDLY_CONFIG = window.FRIENDLY_CONFIG || {
  apiBase: 'https://friendlybarmenu1admin.onrender.com',
};

(function applyFriendlyConfig() {
  const cfg = window.FRIENDLY_CONFIG || {};
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

  if (cfg.apiBase) {
    // On local machine prefer local API if it is running is optional —
    // user asked for Render; use Render everywhere unless localOverride.
    window.FRIENDLY_API_BASE = String(cfg.apiBase).replace(/\/$/, '');
  } else if (isLocal) {
    window.FRIENDLY_API_BASE = location.protocol + '//' + host + ':4000';
  } else {
    window.FRIENDLY_API_BASE = 'https://friendlybarmenu1admin.onrender.com';
  }

  if (cfg.adminUrl) {
    window.FRIENDLY_ADMIN_URL = String(cfg.adminUrl).replace(/\/$/, '');
  }
})();
