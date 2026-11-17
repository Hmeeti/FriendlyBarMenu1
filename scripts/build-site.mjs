/**
 * Build the GitHub Pages bundle into _site/ (run by .github/workflows/deploy-pages.yml):
 *   1. compress new/changed photos into image/opt (WebP 400/800)
 *   2. add translations for dishes that are new or renamed in the admin
 *   3. minify HTML/CSS/JS and menu.json (hidden dishes removed), stamp a cache-busting build id
 *   4. copy fonts, icons and photos
 *
 *   node scripts/build-site.mjs          # full build
 *   node scripts/build-site.mjs --fast   # skip photo compression
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { transform } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const FAST = process.argv.includes('--fast');
const TARGET = ['es2019', 'safari13', 'chrome80', 'firefox78'];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function run(script) {
  execFileSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit', cwd: root });
}

function copyDir(src, dest, skip = () => false) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (skip(from, entry)) continue;
    if (entry.isDirectory()) copyDir(from, to, skip);
    else fs.copyFileSync(from, to);
  }
}

const minJs = async (code) => (await transform(code, { loader: 'js', minify: true, target: TARGET, charset: 'utf8' })).code;
const minCss = async (code) => (await transform(code, { loader: 'css', minify: true, target: TARGET, charset: 'utf8' })).code;

async function minHtml(html) {
  let outHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  const styles = [...outHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  for (const m of styles) outHtml = outHtml.replace(m[0], `<style>${(await minCss(m[1])).trim()}</style>`);
  const scripts = [...outHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const m of scripts) outHtml = outHtml.replace(m[0], `<script>${(await minJs(m[1])).trim()}</script>`);
  return outHtml.replace(/\n\s+/g, '\n').replace(/\n{2,}/g, '\n');
}

/** Guests get a compact menu without hidden dishes. */
function guestMenu() {
  const menu = JSON.parse(read('menu.json'));
  for (const sec of menu.sections || []) sec.items = (sec.items || []).filter((it) => it && !it.hidden);
  return `${JSON.stringify(menu)}\n`;
}

async function main() {
  if (!FAST) run('optimize-images.mjs');
  run('build-i18n-menu.mjs');

  const sources = ['index.html', 'css/menu.css', 'js/app.js', 'js/i18n.js', 'js/i18n-menu.js', 'sw.js', 'admin.html', 'css/admin.css', 'js/admin.js', 'js/config.js'];
  const build = crypto
    .createHash('sha1')
    .update(sources.map(read).join('\n'))
    .digest('hex')
    .slice(0, 10);
  const stamp = (s) => s.replaceAll('__BUILD__', build);

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const write = (f, content) => {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.writeFileSync(path.join(out, f), content);
  };

  write('index.html', await minHtml(stamp(read('index.html'))));
  write('admin.html', stamp(read('admin.html')));
  write('sw.js', await minJs(stamp(read('sw.js'))));
  write('menu.json', guestMenu());
  for (const f of ['css/menu.css', 'css/admin.css']) write(f, await minCss(read(f)));
  for (const f of ['js/app.js', 'js/i18n.js', 'js/i18n-menu.js', 'js/admin.js', 'js/config.js']) write(f, await minJs(read(f)));
  for (const f of ['manifest.webmanifest', 'robots.txt', 'sitemap.xml']) write(f, read(f));
  write('.nojekyll', '');
  copyDir(path.join(root, 'fonts'), path.join(out, 'fonts'));
  copyDir(path.join(root, 'icons'), path.join(out, 'icons'));
  copyDir(path.join(root, 'image'), path.join(out, 'image'), (from, entry) =>
    entry.name === '.DS_Store' || from.endsWith(path.join('opt', 'manifest.json')),
  );

  const report = ['index.html', 'css/menu.css', 'js/app.js', 'js/i18n.js', 'menu.json'].map((f) => {
    const buf = fs.readFileSync(path.join(out, f));
    return `${f.padEnd(14)} ${String(Math.round(buf.length / 102.4) / 10).padStart(6)} KB  gzip ${String(Math.round(zlib.gzipSync(buf).length / 102.4) / 10).padStart(5)} KB`;
  });
  console.log(`\nBuild ${build} → _site/\n${report.join('\n')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
