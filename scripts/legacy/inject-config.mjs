import fs from 'fs';

function injectConfig(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('js/config.js')) {
    console.log(file, 'already has config.js');
    return;
  }

  // Prefer inserting before menu-live / admin-panel / first app script
  if (html.includes('js/menu-live.js')) {
    html = html.replace(
      /<script[^>]*>\s*window\.FRIENDLY_API_BASE[\s\S]*?<\/script>\s*/g,
      ''
    );
    html = html.replace(
      '<script src="js/menu-live.js"></script>',
      '<script src="js/config.js"></script>\n    <script src="js/menu-live.js"></script>'
    );
  } else if (html.includes('js/admin-panel.js')) {
    html = html.replace(
      /<script[^>]*>\s*\/\/ Use same hostname[\s\S]*?<\/script>\s*/g,
      ''
    );
    html = html.replace(
      /<script[^>]*>\s*window\.FRIENDLY_API_BASE[\s\S]*?<\/script>\s*/g,
      ''
    );
    html = html.replace(
      '<script src="js/admin-panel.js"></script>',
      '<script src="js/config.js"></script>\n  <script src="js/admin-panel.js"></script>'
    );
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log('updated', file);
}

injectConfig('index.html');
injectConfig('admin.html');
