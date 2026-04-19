#!/usr/bin/env node
/**
 * Builds the full serien.de branding kit from existing brand (header icon + wordmark).
 *
 * Outputs in /app/serien-nextjs/public/:
 *   logo.png               600×60   navy wordmark on transparent — Google News publisher
 *   logo-white.png         600×60   white wordmark on transparent — dark mode / OG overlays
 *   logo-square.png        512×512  cyan bg + navy "s" — social avatars / manifest
 *   og-image.png           1200×630 Facebook / WhatsApp / LinkedIn 1.91:1 default OG
 *   og-image-dark.png      1200×630 Dark-mode OG variant (navy bg + cyan accents)
 *   twitter-card.png       1200×600 Twitter/X Summary Large Image 2:1
 *   icon-maskable-512.png  512×512  PWA maskable icon w/ 80% safe zone
 *
 * Brand colors extracted from /public/icon-512.png:
 *   cyan   #13bfe0
 *   navy   #062344
 */
import sharp from 'sharp';
import path from 'node:path';

const PUBLIC = '/app/serien-nextjs/public';
const CYAN = '#13bfe0';
const CYAN_DARK = '#0e9dba';
const NAVY = '#062344';
const NAVY_DEEP = '#03152a';
const WHITE = '#ffffff';
const FONT = 'Liberation Sans, FreeSans, Arial, sans-serif';

// ─── small helpers ────────────────────────────────────────────────────────
function svgToPng(svg, file, opts = {}) {
  return sharp(Buffer.from(svg), opts).png({ compressionLevel: 9 }).toFile(path.join(PUBLIC, file));
}

// ─── 1. WORDMARK 600×60 (Google News) ─────────────────────────────────────
function wordmark600({ textColor, iconBg, iconFg }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="60" viewBox="0 0 600 60">
  <circle cx="30" cy="30" r="26" fill="${iconBg}"/>
  <text x="30" y="42" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="42" fill="${iconFg}">s</text>
  <text x="70" y="43" font-family="${FONT}" font-weight="800" font-size="38" letter-spacing="-1" fill="${textColor}">serien.de</text>
</svg>`;
}

// ─── 2. SQUARE 512×512 (Avatar / Manifest) ────────────────────────────────
function square512() {
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="${CYAN}" rx="96"/>
  <text x="256" y="370" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="380" fill="${NAVY}">s</text>
</svg>`;
}

// ─── 3. PWA MASKABLE 512×512 (80% safe zone) ──────────────────────────────
function maskable512() {
  // Android crops to a circle/squircle of ~40% radius from center.
  // Keep meaningful content in center 80% (51→460px on each axis).
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="${CYAN}"/>
  <!-- inner safe zone circle -->
  <circle cx="256" cy="256" r="205" fill="${CYAN}"/>
  <text x="256" y="358" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="310" fill="${NAVY}">s</text>
</svg>`;
}

// ─── 4. OG IMAGE 1200×630 (light default — FB/WhatsApp/LinkedIn) ──────────
function ogLight() {
  // Left: brand block. Right: diagonal navy slab with tagline.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${CYAN}"/>
      <stop offset="1" stop-color="${CYAN_DARK}"/>
    </linearGradient>
  </defs>
  <!-- bg -->
  <rect width="1200" height="630" fill="url(#g1)"/>
  <!-- large translucent "s" decoration -->
  <text x="-50" y="720" font-family="${FONT}" font-weight="900" font-size="820" fill="${NAVY}" fill-opacity="0.10">s</text>
  <!-- navy diagonal slab right -->
  <polygon points="720,0 1200,0 1200,630 580,630" fill="${NAVY}"/>
  <!-- logo on cyan side -->
  <circle cx="120" cy="120" r="40" fill="${NAVY}"/>
  <text x="120" y="138" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="64" fill="${CYAN}">s</text>
  <text x="180" y="140" font-family="${FONT}" font-weight="800" font-size="56" fill="${NAVY}" letter-spacing="-1">serien.de</text>
  <!-- title on navy side -->
  <text x="760" y="250" font-family="${FONT}" font-weight="800" font-size="52" fill="${WHITE}">Serien-News,</text>
  <text x="760" y="320" font-family="${FONT}" font-weight="800" font-size="52" fill="${WHITE}">Reviews &amp;</text>
  <text x="760" y="390" font-family="${FONT}" font-weight="800" font-size="52" fill="${CYAN}">Streaming.</text>
  <!-- tagline -->
  <text x="760" y="470" font-family="${FONT}" font-weight="500" font-size="26" fill="${WHITE}" fill-opacity="0.75">Alles zu deinen Lieblingsserien</text>
  <!-- url tag -->
  <rect x="760" y="510" width="180" height="44" rx="22" fill="${CYAN}"/>
  <text x="850" y="540" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="22" fill="${NAVY}">serien.de</text>
</svg>`;
}

// ─── 5. OG IMAGE DARK 1200×630 ────────────────────────────────────────────
function ogDark() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <radialGradient id="rg" cx="0.15" cy="0.2" r="0.6">
      <stop offset="0" stop-color="${CYAN}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${NAVY}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <rect width="1200" height="630" fill="url(#rg)"/>
  <!-- ghost "s" -->
  <text x="-40" y="720" font-family="${FONT}" font-weight="900" font-size="820" fill="${CYAN}" fill-opacity="0.08">s</text>
  <!-- brand lockup centered -->
  <circle cx="140" cy="130" r="46" fill="${CYAN}"/>
  <text x="140" y="150" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="72" fill="${NAVY}">s</text>
  <text x="210" y="152" font-family="${FONT}" font-weight="800" font-size="62" fill="${WHITE}" letter-spacing="-1">serien.de</text>
  <!-- main title -->
  <text x="140" y="290" font-family="${FONT}" font-weight="800" font-size="78" fill="${WHITE}">Serien, die du</text>
  <text x="140" y="380" font-family="${FONT}" font-weight="800" font-size="78" fill="${CYAN}">nicht verpassen willst.</text>
  <!-- tagline -->
  <text x="140" y="470" font-family="${FONT}" font-weight="500" font-size="32" fill="${WHITE}" fill-opacity="0.7">News · Reviews · Streaming · Trailer</text>
  <!-- pill -->
  <rect x="140" y="520" width="220" height="50" rx="25" fill="${CYAN}"/>
  <text x="250" y="553" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="24" fill="${NAVY}">auf serien.de</text>
</svg>`;
}

// ─── 6. TWITTER / X CARD 1200×600 (2:1) ───────────────────────────────────
function twitterCard() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="gx" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#gx)"/>
  <!-- cyan accent stripe bottom -->
  <rect x="0" y="560" width="1200" height="40" fill="${CYAN}"/>
  <!-- ghost s -->
  <text x="820" y="720" font-family="${FONT}" font-weight="900" font-size="820" fill="${CYAN}" fill-opacity="0.09">s</text>
  <!-- logo lockup -->
  <circle cx="120" cy="110" r="40" fill="${CYAN}"/>
  <text x="120" y="128" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="64" fill="${NAVY}">s</text>
  <text x="180" y="130" font-family="${FONT}" font-weight="800" font-size="56" fill="${WHITE}" letter-spacing="-1">serien.de</text>
  <!-- main -->
  <text x="120" y="270" font-family="${FONT}" font-weight="800" font-size="78" fill="${WHITE}">Serien-News,</text>
  <text x="120" y="360" font-family="${FONT}" font-weight="800" font-size="78" fill="${CYAN}">die du suchst.</text>
  <!-- tagline -->
  <text x="120" y="450" font-family="${FONT}" font-weight="500" font-size="30" fill="${WHITE}" fill-opacity="0.7">Täglich neue News, Reviews &amp; Streaming-Tipps</text>
</svg>`;
}

// ─── BUILD ────────────────────────────────────────────────────────────────
async function build() {
  const out = [];

  // Wordmarks
  await svgToPng(wordmark600({ textColor: NAVY,  iconBg: CYAN, iconFg: NAVY }), 'logo.png');           out.push('logo.png');
  await svgToPng(wordmark600({ textColor: WHITE, iconBg: CYAN, iconFg: NAVY }), 'logo-white.png');     out.push('logo-white.png');

  // Square + maskable
  await svgToPng(square512(),    'logo-square.png');    out.push('logo-square.png');
  await svgToPng(maskable512(),  'icon-maskable-512.png'); out.push('icon-maskable-512.png');

  // OG + Twitter
  await svgToPng(ogLight(),     'og-image.png');       out.push('og-image.png');
  await svgToPng(ogDark(),      'og-image-dark.png');  out.push('og-image-dark.png');
  await svgToPng(twitterCard(), 'twitter-card.png');   out.push('twitter-card.png');

  console.log('Generated:');
  for (const f of out) {
    const m = await sharp(path.join(PUBLIC, f)).metadata();
    const stat = (await import('node:fs/promises')).stat(path.join(PUBLIC, f));
    const kb = ((await stat).size / 1024).toFixed(1);
    console.log(`  ${f.padEnd(26)} ${m.width}×${m.height}  ${kb} KB  alpha=${m.hasAlpha}`);
  }
}
build().catch(e => { console.error(e); process.exit(1); });
