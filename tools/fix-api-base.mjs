import fs from 'fs';

let h = fs.readFileSync('index.html', 'utf8');

const apiInit = `<script>
      window.FRIENDLY_API_BASE =
        window.FRIENDLY_API_BASE ||
        (location.protocol + '//' + location.hostname + ':4000');
    </script>`;

// Remove hard-coded localhost API bases and ensure one smart init before menu-live
h = h.replace(/<script>\s*window\.FRIENDLY_API_BASE\s*=\s*'http:\/\/localhost:4000';\s*<\/script>\s*/g, '');
h = h.replace(
  /<script>\s*window\.FRIENDLY_API_BASE\s*=\s*window\.FRIENDLY_API_BASE\s*\|\|\s*'http:\/\/localhost:4000';\s*window\.FRIENDLY_ADMIN_URL[\s\S]*?<\/script>\s*/g,
  ''
);

if (!h.includes("location.hostname + ':4000'")) {
  if (h.includes('js/menu-live.js')) {
    h = h.replace(
      '<script src="js/menu-live.js"></script>',
      `${apiInit}\n    <script src="js/menu-live.js"></script>`
    );
  } else {
    h = h.replace('</body>', `${apiInit}\n</body>`);
  }
}

fs.writeFileSync('index.html', h, 'utf8');
console.log('index.html API base updated');
