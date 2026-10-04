/**
 * Batch-compress menu photos into WebP thumbnails (400px) and large previews (800px).
 *
 *   node scripts/optimize-images.mjs            # process new / changed photos
 *   node scripts/optimize-images.mjs --force    # rebuild everything
 *   node scripts/optimize-images.mjs --out _site/image/opt   # write into another folder
 *
 * Originals stay untouched in image/ (that is the "originals" folder — the admin panel and
 * the Render database reference those paths). Optimized copies go to image/opt/ with the
 * same relative path: image/admin/x.jpg -> image/opt/admin/x-400.webp, x-800.webp.
 * The frontend derives these paths from the original one (see optimizedImagePath in app.js).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(root, 'image');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0 ? path.resolve(root, args[outIdx + 1]) : path.join(SRC_DIR, 'opt');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const SIZES = [
  { suffix: '400', width: 400, maxBytes: 50 * 1024 },
  { suffix: '800', width: 800, maxBytes: 150 * 1024 },
];
const START_QUALITY = 75;
const MIN_QUALITY = 45;
const SKIP_DIRS = new Set(['opt', 'icons', 'originals']);
const SKIP_FILES = new Set(['nono.png', 'favicon.png']);
const EXT = /\.(png|jpe?g|webp)$/i;

function walk(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!rel && SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), relPath));
    } else if (EXT.test(entry.name) && !SKIP_FILES.has(entry.name)) {
      out.push(relPath);
    }
  }
  return out;
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}

async function encode(input, width, maxBytes) {
  let quality = START_QUALITY;
  let buf;
  for (;;) {
    buf = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 5, smartSubsample: true })
      .toBuffer();
    if (buf.length <= maxBytes || quality <= MIN_QUALITY) break;
    quality -= 7;
  }
  return { buf, quality };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = readManifest();
  const files = walk(SRC_DIR);
  let made = 0;
  let skipped = 0;
  let before = 0;
  let after = 0;
  const overBudget = [];

  for (const rel of files) {
    const abs = path.join(SRC_DIR, rel);
    const input = fs.readFileSync(abs);
    const hash = crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
    const stem = rel.replace(EXT, '');
    const targets = SIZES.map((s) => ({ ...s, file: path.join(OUT_DIR, `${stem}-${s.suffix}.webp`) }));
    const key = `image/${rel}`;

    if (!FORCE && manifest[key]?.hash === hash && targets.every((t) => fs.existsSync(t.file))) {
      skipped += 1;
      continue;
    }

    const meta = await sharp(input).rotate().metadata();
    const entry = { hash, width: meta.width, height: meta.height, out: {} };
    for (const t of targets) {
      fs.mkdirSync(path.dirname(t.file), { recursive: true });
      const { buf, quality } = await encode(input, t.width, t.maxBytes);
      fs.writeFileSync(t.file, buf);
      entry.out[t.suffix] = { bytes: buf.length, quality };
      if (buf.length > t.maxBytes) overBudget.push(`${rel} @${t.suffix}: ${Math.round(buf.length / 1024)} KB`);
      after += buf.length;
    }
    before += input.length;
    manifest[key] = entry;
    made += 1;
    console.log(`✓ ${rel}  ${Math.round(input.length / 1024)} KB → ${SIZES.map((s) => `${s.suffix}: ${Math.round(entry.out[s.suffix].bytes / 1024)} KB`).join(', ')}`);
  }

  for (const key of Object.keys(manifest)) {
    if (!files.includes(key.replace(/^image\//, ''))) delete manifest[key];
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);

  console.log(`\nDone: ${made} processed, ${skipped} unchanged.`);
  if (made) console.log(`Originals ${Math.round(before / 1024)} KB → WebP (both sizes) ${Math.round(after / 1024)} KB`);
  if (overBudget.length) console.warn(`Over budget even at q${MIN_QUALITY}:\n  ${overBudget.join('\n  ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
