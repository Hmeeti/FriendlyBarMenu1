import fs from 'fs';

let theme = fs.readFileSync('css/blocks/theme.css', 'utf8');
const darkHeader = `
[data-theme='dark'] .header {
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    border-bottom-color: var(--color-border);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
}
`;
if (!theme.includes("[data-theme='dark'] .header")) {
  fs.writeFileSync('css/blocks/theme.css', theme.trimEnd() + '\n' + darkHeader + '\n', 'utf8');
  console.log('theme updated');
}

let html = fs.readFileSync('index.html', 'utf8');

const footerOld = `<div class="footer-bottom">
            <p class="footer-protection">
                <span class="shield-icon">🛡️</span> Сайт полностью защищен безопасным соединением.
            </p>
            <p class="footer__creator">made by hmeeti</p>
            <p class="footer-copyright">
                &copy; 2026 Все права защищены. Копирование материалов запрещено.
            </p>
        </div>`;

const footerNew = `<div class="footer-bottom">
            <p class="footer-protection">
                <span class="shield-icon">🛡️</span> Сайт полностью защищен безопасным соединением.
            </p>
            <p class="footer__creator">made by hmeeti</p>
            <p class="footer-copyright">
                &copy; 2026 Все права защищены. Копирование материалов запрещено.
            </p>
            <button type="button" class="footer-admin-link" id="adminLoginBtn" aria-label="Admin">
                ·
            </button>
        </div>`;

if (!html.includes('adminLoginBtn')) {
  if (!html.includes(footerOld)) {
    console.error('footer block not found');
    process.exit(1);
  }
  html = html.replace(footerOld, footerNew);
}

const modalHtml = `
    <div class="admin-login-modal" id="adminLoginModal" hidden>
        <div class="admin-login-modal__backdrop" data-admin-close></div>
        <div class="admin-login-modal__panel" role="dialog" aria-modal="true" aria-labelledby="adminLoginTitle">
            <button type="button" class="admin-login-modal__close" data-admin-close aria-label="Закрыть">×</button>
            <h2 id="adminLoginTitle" class="admin-login-modal__title">Вход</h2>
            <p class="admin-login-modal__hint">Доступ только для администраторов</p>
            <form id="adminLoginForm" class="admin-login-form" autocomplete="on">
                <label class="admin-login-form__label">
                    Логин
                    <input class="admin-login-form__input" name="login" type="text" required autocomplete="username" />
                </label>
                <label class="admin-login-form__label">
                    Пароль
                    <input class="admin-login-form__input" name="password" type="password" required autocomplete="current-password" />
                </label>
                <p class="admin-login-form__error" id="adminLoginError" hidden></p>
                <button class="admin-login-form__submit" type="submit">Войти</button>
            </form>
        </div>
    </div>
`;

if (!html.includes('adminLoginModal')) {
  html = html.replace('</footer>', `</footer>\n${modalHtml}`);
}

// wire scripts
if (!html.includes('admin-login.js')) {
  html = html.replace(
    '<script src="js/menu-live.js"></script>',
    `<script src="js/menu-live.js"></script>
    <script>
      window.FRIENDLY_API_BASE = window.FRIENDLY_API_BASE || 'http://localhost:4000';
      window.FRIENDLY_ADMIN_URL = window.FRIENDLY_ADMIN_URL || 'http://localhost:5173';
    </script>
    <script src="js/admin-login.js"></script>`
  );
}

// remove broken extract-menu script if present
html = html.replace(/\s*<script src="tools\/extract-menu\.mjs"><\/script>/, '');

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html updated');
