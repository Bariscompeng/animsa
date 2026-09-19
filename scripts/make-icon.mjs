#!/usr/bin/env node
/**
 * Renders assets/icon.svg into the PNGs the app config needs (§7.2).
 *
 * iOS app icons must have NO alpha channel — a transparent icon is rejected
 * and, worse, silently renders black — so the alpha is flattened onto the
 * brand orange here.
 *
 *   node scripts/make-icon.mjs
 */
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const ACCENT = { r: 0xff, g: 0x7a, b: 0x1a };

const svg = readFileSync(join(assets, 'icon.svg'));

/** The dev variant gets a darker tint so the two are told apart on the home screen. */
const devSvg = Buffer.from(
  svg
    .toString('utf8')
    .replace('#FF9142', '#7A8CFF')
    .replace('#F26A00', '#3A4BD8'),
);

async function render(source, name, { size = 1024, flatten = true } = {}) {
  let pipeline = sharp(source, { density: 400 }).resize(size, size, { fit: 'cover' });
  if (flatten) {
    // Removes the alpha channel entirely, which is what App Store / iOS want.
    pipeline = pipeline.flatten({ background: ACCENT });
  }
  const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const target = join(assets, name);
  writeFileSync(target, buffer);

  const meta = await sharp(buffer).metadata();
  const alphaNote = meta.hasAlpha
    ? flatten
      ? 'VAR (hata!)'
      : 'var (bu dosyada beklenen)'
    : 'yok';
  console.log(
    `✓ ${name} — ${meta.width}×${meta.height}, kanal: ${meta.channels}, alfa: ${alphaNote}`,
  );
  if (flatten && meta.hasAlpha) {
    throw new Error(`${name} alfa kanalı içeriyor; iOS ikonu bunu kabul etmez.`);
  }
}

await render(svg, 'icon.png');
await render(devSvg, 'icon-dev.png');
// The splash image sits on a coloured background, so it keeps its alpha.
await render(svg, 'splash-icon.png', { size: 512, flatten: false });

console.log('İkonlar üretildi.');
