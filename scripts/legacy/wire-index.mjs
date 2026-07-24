import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('menu-live.js')) {
  html = html.replace(
    '<script src="js/script.js"></script>',
    `<script src="js/script.js"></script>
    <script>window.FRIENDLY_API_BASE = 'http://localhost:4000';</script>
    <script src="js/menu-live.js"></script>`
  );
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('index.html updated');
} else {
  console.log('already wired');
}
