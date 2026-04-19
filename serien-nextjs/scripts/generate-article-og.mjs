#!/usr/bin/env node
/**
 * PROTOTYPE — Article OG Image Generator
 *
 * Generates a 1200×630 OG image composed from:
 *   • Series backdrop (blurred as background)
 *   • Dark navy gradient overlay for legibility
 *   • Series poster thumbnail (right side)
 *   • Article headline (wrapped, left)
 *   • Serien.de branding + date
 *
 * Usage:  node scripts/generate-article-og.mjs <article-id>
 *         node scripts/generate-article-og.mjs <article-slug>
 *
 * Output: /app/serien-nextjs/public/og-samples/<slug>.jpg
 */
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const CYAN = '#13bfe0';
const NAVY = '#062344';
const NAVY_DEEP = '#03152a';
const WHITE = '#ffffff';
const FONT = 'Liberation Sans, FreeSans, Arial, sans-serif';

const W = 1200, H = 630;

const prisma = new PrismaClient();

// simple word-wrap helper for SVG <text>
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? line + ' ' : '') + w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function buildBackground(backdropUrl) {
  // Download + resize + blur backdrop to 1200×630; if missing, solid navy
  if (!backdropUrl) {
    return sharp({ create: { width: W, height: H, channels: 3, background: NAVY } }).png().toBuffer();
  }
  const raw = await fetchBytes(backdropUrl);
  return sharp(raw)
    .resize(W, H, { fit: 'cover', position: 'center' })
    .blur(14)
    .modulate({ brightness: 0.45, saturation: 0.8 })
    .png()
    .toBuffer();
}

async function buildPoster(posterUrl) {
  if (!posterUrl) return null;
  const raw = await fetchBytes(posterUrl);
  return sharp(raw).resize(270, 400, { fit: 'cover' }).png().toBuffer();
}

function overlaySVG({ headline, seriesTitle, dateStr, hasPoster }) {
  // gradient overlay + brand + text
  const posterSlot = hasPoster ? 330 : 0;
  const maxLineChars = hasPoster ? 22 : 30;
  const headLines = wrap(headline, maxLineChars).slice(0, 4);
  const leading = 72;
  const headY0 = 320;

  const headText = headLines
    .map((l, i) => `<text x="60" y="${headY0 + i*leading}" font-family="${FONT}" font-weight="800" font-size="58" fill="${WHITE}">${esc(l)}</text>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="overlay" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="${NAVY_DEEP}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${NAVY}"     stop-opacity="0.85"/>
      <stop offset="1"    stop-color="${NAVY}"     stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="brandbar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${CYAN}"/>
      <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#overlay)"/>

  <!-- top brand lockup -->
  <circle cx="90" cy="90" r="36" fill="${CYAN}"/>
  <text x="90" y="107" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="54" fill="${NAVY}">s</text>
  <text x="142" y="108" font-family="${FONT}" font-weight="800" font-size="46" fill="${WHITE}" letter-spacing="-1">serien.de</text>

  <!-- category pill: series name -->
  <rect x="60" y="220" width="${Math.min(600, 40 + seriesTitle.length * 15)}" height="46" rx="23" fill="${CYAN}"/>
  <text x="80" y="252" font-family="${FONT}" font-weight="800" font-size="22" fill="${NAVY}" letter-spacing="0.5">${esc(seriesTitle.toUpperCase())}</text>

  <!-- headline -->
  ${headText}

  <!-- bottom brand bar -->
  <rect x="0" y="586" width="${W}" height="4" fill="url(#brandbar)"/>
  <text x="60" y="612" font-family="${FONT}" font-weight="500" font-size="22" fill="${WHITE}" fill-opacity="0.7">${esc(dateStr)} · serien.de</text>
</svg>`;
}

async function run(argv) {
  const key = argv[2];
  if (!key) throw new Error('Usage: generate-article-og.mjs <article-id-or-slug>');

  const article = await prisma.articles.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id:true, slug:true, title:true, publishedAt:true, primarySeriesId:true },
  });
  if (!article) throw new Error(`Article not found: ${key}`);

  let series = null;
  if (article.primarySeriesId) {
    series = await prisma.series.findUnique({
      where: { tmdbId: article.primarySeriesId },
      select: { title:true, posterLocalUrl:true, backdropLocalUrl:true },
    });
  }

  console.log('→ Article :', article.title);
  console.log('→ Series  :', series?.title || '—');
  console.log('→ Backdrop:', series?.backdropLocalUrl || '—');

  const dateStr = new Date(article.publishedAt).toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' });

  const [bg, poster] = await Promise.all([
    buildBackground(series?.backdropLocalUrl),
    buildPoster(series?.posterLocalUrl),
  ]);

  const overlay = Buffer.from(overlaySVG({
    headline: article.title,
    seriesTitle: series?.title || 'Serien-News',
    dateStr,
    hasPoster: !!poster,
  }));

  const composites = [{ input: overlay, top: 0, left: 0 }];
  if (poster) composites.push({ input: poster, top: 140, left: W - 330 });

  const outDir = '/app/serien-nextjs/public/og-samples';
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${article.slug}.jpg`);

  await sharp(bg)
    .composite(composites)
    .jpeg({ quality: 88, progressive: true, mozjpeg: true })
    .toFile(outPath);

  const stat = await fs.stat(outPath);
  console.log(`✓ ${outPath}  (${(stat.size/1024).toFixed(1)} KB)`);
  console.log(`  → http://localhost:3000/og-samples/${article.slug}.jpg`);

  await prisma.$disconnect();
}
run(process.argv).catch(e => { console.error(e); process.exit(1); });
