import fs from 'fs';

let h = fs.readFileSync('index.html', 'utf8');

if (!h.includes('header-admin-btn')) {
  const cartBtn = `<button type="button" class="cart-btn" onclick="toggleCart()" aria-label="Список заказа">
                        Заказ
                        <span class="cart-count">0</span>
                    </button>`;
  const withAdmin = `<a href="admin.html" class="header-admin-btn" title="Админ-панель">Admin</a>
                    ${cartBtn}`;
  if (!h.includes(cartBtn)) {
    // try looser match
    h = h.replace(
      /<button type="button" class="cart-btn" onclick="toggleCart\(\)" aria-label="[^"]*">[\s\S]*?<\/button>/,
      (m) => `<a href="admin.html" class="header-admin-btn" title="Админ-панель">Admin</a>\n                    ${m}`
    );
  } else {
    h = h.replace(cartBtn, withAdmin);
  }
}

h = h.replace(
  /<button type="button" class="footer-admin-link" id="adminLoginBtn"[^>]*>[\s\S]*?<\/button>/,
  '<a href="admin.html" class="footer-admin-link" title="Админ">·</a>'
);

fs.writeFileSync('index.html', h, 'utf8');
console.log('index.html patched', {
  header: h.includes('header-admin-btn'),
  footerLink: h.includes('footer-admin-link') && h.includes('href="admin.html"'),
});

let css = fs.readFileSync('css/style.css', 'utf8');
if (!css.includes('admin-entry.css')) {
  css = css.replace(
    '@import "blocks/header.css";',
    '@import "blocks/header.css";\n@import "blocks/admin-entry.css";'
  );
  fs.writeFileSync('css/style.css', css, 'utf8');
  console.log('style.css import added');
}
