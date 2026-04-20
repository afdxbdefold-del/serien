/**
 * Generates a branded 1920×1080 hero image on-the-fly for series that have
 * no TMDB backdrop. Uses sharp + SVG with our brand palette + series title.
 *
 * Called from /img/hero/[type]/[id] when storeAllImagesForItem returns null.
 */
import sharp from 'sharp';

const CYAN = '#13bfe0';
const NAVY = '#062344';
const NAVY_DEEP = '#03152a';
const WHITE = '#ffffff';
const FONT = 'Liberation Sans, FreeSans, Arial, sans-serif';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
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

export async function generateBrandedHero(options: {
  title: string;
  network?: string | null;
  genre?: string | null;
  status?: string | null;
}): Promise<Buffer> {
  const W = 1920, H = 1080;
  const title = (options.title || 'Serie').trim();
  const network = (options.network || '').trim();
  const tagline = options.status === 'In Production' ? 'Noch nicht gestartet · Bald verfügbar'
    : options.status === 'Returning Series' ? 'Neue Staffel angekündigt'
    : 'Auf serien.de entdecken';

  // Choose font size based on title length
  const titleLen = title.length;
  const fontSize = titleLen <= 10 ? 220 : titleLen <= 18 ? 170 : titleLen <= 28 ? 130 : 95;
  const lines = wrap(title, titleLen <= 10 ? 12 : 20).slice(0, 2);

  const yStart = H / 2 - (lines.length - 1) * fontSize / 2 - 20;
  const titleSVG = lines
    .map((l, i) => `<text x="${W/2}" y="${yStart + i * fontSize * 1.05}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${fontSize}" fill="${WHITE}" letter-spacing="-2">${esc(l)}</text>`)
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <radialGradient id="accent" cx="0.2" cy="0.25" r="0.65">
      <stop offset="0" stop-color="${CYAN}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
      <circle cx="30" cy="30" r="1.2" fill="${CYAN}" fill-opacity="0.18"/>
    </pattern>
  </defs>

  <!-- base gradient -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#accent)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>

  <!-- oversized ghost "s" right -->
  <text x="${W + 80}" y="${H + 100}" text-anchor="end" font-family="${FONT}" font-weight="900" font-size="1400" fill="${CYAN}" fill-opacity="0.10">s</text>

  <!-- brand lockup top-left -->
  <circle cx="90" cy="90" r="36" fill="${CYAN}"/>
  <text x="90" y="106" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="50" fill="${NAVY}">s</text>
  <text x="148" y="104" font-family="${FONT}" font-weight="800" font-size="44" fill="${WHITE}" letter-spacing="-1">serien.de</text>

  <!-- network badge top-right (optional) -->
  ${network ? `<rect x="${W - 60 - (network.length * 13 + 40)}" y="64" width="${network.length * 13 + 40}" height="52" rx="26" fill="${CYAN}"/>
  <text x="${W - 60 - (network.length * 13 + 40) / 2}" y="98" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="22" fill="${NAVY}" letter-spacing="0.5">${esc(network.toUpperCase())}</text>` : ''}

  <!-- subtle accent bars -->
  <rect x="${W/2 - 70}" y="${yStart - 60}" width="140" height="4" fill="${CYAN}"/>

  <!-- title -->
  ${titleSVG}

  <!-- tagline -->
  <text x="${W/2}" y="${yStart + lines.length * fontSize * 1.05 + 55}" text-anchor="middle" font-family="${FONT}" font-weight="500" font-size="30" fill="${WHITE}" fill-opacity="0.65">${esc(tagline)}</text>

  <!-- bottom accent bar -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${CYAN}"/>
</svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 85, progressive: true, mozjpeg: true }).toBuffer();
}
