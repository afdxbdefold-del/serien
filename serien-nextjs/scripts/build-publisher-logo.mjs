#!/usr/bin/env node
/**
 * Builds publisher logos from the existing brand (header icon + wordmark).
 * Outputs:
 *  - /app/serien-nextjs/public/logo.png        (600×60, transparent, navy on transparent — for Google News)
 *  - /app/serien-nextjs/public/logo-white.png  (600×60, transparent, white — for dark backgrounds)
 *  - /app/serien-nextjs/public/logo-square.png (512×512, cyan bg + navy "s" — for social/avatar)
 *
 * Visual identity (from /public/icon-512.png + header):
 *   cyan BG  #13bfe0
 *   navy    #062344
 */
import sharp from 'sharp';
import path from 'node:path';

const PUBLIC = '/app/serien-nextjs/public';
const CYAN  = '#13bfe0';
const NAVY  = '#062344';
const WHITE = '#ffffff';

// ─── Logo 600×60 — icon circle + wordmark ──────────────────────────────────
function wordmarkSVG({ textColor, iconBg, iconFg, W = 600, H = 60 }) {
  // Icon circle on the left (52×52 centered vertically in 60px), text to the right.
  const r = 26;              // icon radius
  const cx = 30, cy = H / 2; // icon center
  const textX = 70;          // wordmark start
  const textY = 43;          // baseline tuned for 38px font
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${iconBg}"/>
  <text x="${cx}" y="${cy + 12}" text-anchor="middle"
        font-family="Liberation Sans, FreeSans, Arial, sans-serif"
        font-weight="900" font-size="42" fill="${iconFg}">s</text>
  <text x="${textX}" y="${textY}"
        font-family="Liberation Sans, FreeSans, Arial, sans-serif"
        font-weight="800" font-size="38" letter-spacing="-1"
        fill="${textColor}">serien.de</text>
</svg>`;
}

async function build() {
  // A: dark wordmark (for light/white backgrounds — Google News uses this on white)
  await sharp(Buffer.from(
    wordmarkSVG({ textColor: NAVY, iconBg: CYAN, iconFg: NAVY })
  ))
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC, 'logo.png'));
  console.log('✓ logo.png (600×60, dark wordmark)');

  // B: white wordmark (for dark backgrounds — e.g. our own dark mode, opengraph overlays)
  await sharp(Buffer.from(
    wordmarkSVG({ textColor: WHITE, iconBg: CYAN, iconFg: NAVY })
  ))
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC, 'logo-white.png'));
  console.log('✓ logo-white.png (600×60, white wordmark)');

  // C: square 512×512 — big "s" centered on cyan (reuse for manifest / social)
  const sq = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="${CYAN}" rx="96"/>
  <text x="256" y="370" text-anchor="middle"
        font-family="Liberation Sans, FreeSans, Arial, sans-serif"
        font-weight="900" font-size="380" fill="${NAVY}">s</text>
</svg>`;
  await sharp(Buffer.from(sq)).png({ compressionLevel: 9 }).toFile(path.join(PUBLIC, 'logo-square.png'));
  console.log('✓ logo-square.png (512×512, icon-style)');

  // Verify
  for (const f of ['logo.png', 'logo-white.png', 'logo-square.png']) {
    const m = await sharp(path.join(PUBLIC, f)).metadata();
    console.log(`   ${f} → ${m.width}×${m.height}  ${(m.size/1024).toFixed(1)}KB  alpha=${m.hasAlpha}`);
  }
}
build().catch(e => { console.error(e); process.exit(1); });
