/**
 * Discreet footer admin login modal.
 * Config:
 *   window.FRIENDLY_API_BASE = 'http://localhost:4000'
 *   window.FRIENDLY_ADMIN_URL = 'http://localhost:5173'
 */
(function () {
  function boot() {
    const API = (window.FRIENDLY_API_BASE || 'http://localhost:4000').replace(/\/$/, '');
    const ADMIN_URL = (window.FRIENDLY_ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');

    const btn = document.getElementById('adminLoginBtn');
    const modal = document.getElementById('adminLoginModal');
    const form = document.getElementById('adminLoginForm');
    const errEl = document.getElementById('adminLoginError');
    if (!btn || !modal || !form) return;

    function openModal() {
      modal.hidden = false;
      document.body.classList.add('admin-login-open');
      const loginInput = form.querySelector('[name="login"]');
      if (loginInput) loginInput.focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('admin-login-open');
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = '';
      }
      form.reset();
    }

    function showError(msg) {
      if (!errEl) return;
      errEl.hidden = !msg;
      errEl.textContent = msg || '';
    }

    btn.addEventListener('click', openModal);
    modal.querySelectorAll('[data-admin-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const login = String(fd.get('login') || '').trim();
      const password = String(fd.get('password') || '');
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      showError('');

      try {
        const res = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Неверный логин или пароль');

        if (data.token) {
          try {
            sessionStorage.setItem('fm_admin_token', data.token);
          } catch (_) {}
        }
        window.location.href = `${ADMIN_URL}/`;
      } catch (err) {
        showError(err.message || 'Ошибка входа');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
