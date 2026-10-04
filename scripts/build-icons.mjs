/**
 * Favicon, PWA / apple-touch icons and the social preview image from image/favicon.png.
 *   node scripts/build-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'image', 'favicon.png');
const out = path.join(root, 'icons');
const BG = { r: 12, g: 10, b: 11, alpha: 1 };
fs.mkdirSync(out, { recursive: true });

// Shield emblem without the wordmark — readable at 32-192 px.
const SHIELD = { left: 481, top: 231, width: 640, height: 640 };

async function shield(size, file, pad = 0) {
  const inner = Math.round(size * (1 - pad * 2));
  const emblem = await sharp(src).extract(SHIELD).resize(inner, inner).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: emblem, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 })
    .toFile(path.join(out, file));
}

async function logo(width, height, file, format) {
  const emblem = await sharp(src)
    .resize({ width: Math.round(width * 0.9), height: Math.round(height * 0.9), fit: 'inside' })
    .toBuffer();
  let img = sharp({ create: { width, height, channels: 4, background: BG } }).composite([
    { input: emblem, gravity: 'center' },
  ]);
  img = format === 'jpg' ? img.jpeg({ quality: 78, mozjpeg: true }) : img.png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 });
  await img.toFile(path.join(out, file));
}

await shield(32, 'favicon-32.png');
await shield(180, 'apple-touch-icon.png', 0.04);
await shield(192, 'icon-192.png', 0.04);
await logo(512, 512, 'icon-512.png', 'png');
await shield(512, 'icon-maskable-512.png', 0.14);
await logo(1200, 630, 'og-image.jpg', 'jpg');

for (const f of fs.readdirSync(out)) {
  console.log(f, `${Math.round(fs.statSync(path.join(out, f)).size / 1024)} KB`);
}
