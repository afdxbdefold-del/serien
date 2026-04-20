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
  posterPath?: string | null;    // TMDB relative path, e.g. /abc.jpg
  tmdbId?: number | null;
}): Promise<Buffer> {
  const W = 1920, H = 1080;
  const title = (options.title || 'Serie').trim();
  const network = (options.network || '').trim();
  const tagline = options.status === 'In Production' ? 'Noch nicht gestartet · Bald verfügbar'
    : options.status === 'Returning Series' ? 'Neue Staffel angekündigt'
    : 'Auf serien.de entdecken';

  // Try to load and composite the TMDB poster on the right
  let posterBuf: Buffer | null = null;
  let posterBlurBuf: Buffer | null = null;
  if (options.posterPath) {
    try {
      const posterUrl = `https://image.tmdb.org/t/p/w500${options.posterPath.startsWith('/') ? options.posterPath : '/' + options.posterPath}`;
      const r = await fetch(posterUrl);
      if (r.ok) {
        const raw = Buffer.from(await r.arrayBuffer());
        // Poster right side: 500×750 scaled to ~520×780
        posterBuf = await sharp(raw).resize(520, 780, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
        // Blurred large poster as background layer — strong blur + dark tint so title is readable
        posterBlurBuf = await sharp(raw)
          .resize(W, H, { fit: 'cover', position: 'center' })
          .blur(80)
          .modulate({ brightness: 0.22, saturation: 0.6 })
          .jpeg({ quality: 78 })
          .toBuffer();
      }
    } catch {
      // silent fail — we'll use gradient-only fallback
    }
  }

  // Layout: if poster available → title left, poster right
  // else → title centered
  const hasPoster = posterBuf !== null;
  const titleX = hasPoster ? 120 : W / 2;
  const textAnchor = hasPoster ? 'start' : 'middle';

  const titleLen = title.length;
  const fontSize = hasPoster
    ? (titleLen <= 10 ? 180 : titleLen <= 18 ? 140 : titleLen <= 28 ? 105 : 80)
    : (titleLen <= 10 ? 220 : titleLen <= 18 ? 170 : titleLen <= 28 ? 130 : 95);
  const maxChars = hasPoster ? (titleLen <= 10 ? 14 : 22) : (titleLen <= 10 ? 12 : 20);
  const lines = wrap(title, maxChars).slice(0, 3);

  const yStart = H / 2 - (lines.length - 1) * fontSize / 2 - 20;
  const titleSVG = lines
    .map((l, i) => `<text x="${titleX}" y="${yStart + i * fontSize * 1.05}" text-anchor="${textAnchor}" font-family="${FONT}" font-weight="900" font-size="${fontSize}" fill="${WHITE}" letter-spacing="-2">${esc(l)}</text>`)
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
    <linearGradient id="leftShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${NAVY_DEEP}" stop-opacity="0.97"/>
      <stop offset="0.5" stop-color="${NAVY_DEEP}" stop-opacity="0.88"/>
      <stop offset="0.75" stop-color="${NAVY_DEEP}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${NAVY_DEEP}" stop-opacity="0.2"/>
    </linearGradient>
  </defs>

  ${hasPoster ? '' : `<rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#accent)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>`}

  ${hasPoster ? `<!-- dark gradient over blurred poster background -->
  <rect width="${W}" height="${H}" fill="url(#leftShade)"/>
  <rect width="${W}" height="${H}" fill="url(#accent)"/>` : `<!-- oversized ghost "s" -->
  <text x="${W + 80}" y="${H + 100}" text-anchor="end" font-family="${FONT}" font-weight="900" font-size="1400" fill="${CYAN}" fill-opacity="0.10">s</text>`}

  <!-- brand lockup top-left -->
  <circle cx="90" cy="90" r="36" fill="${CYAN}"/>
  <text x="90" y="106" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="50" fill="${NAVY}">s</text>
  <text x="148" y="104" font-family="${FONT}" font-weight="800" font-size="44" fill="${WHITE}" letter-spacing="-1">serien.de</text>

  ${network ? `<!-- network badge top-right -->
  <rect x="${W - 60 - (network.length * 13 + 40)}" y="64" width="${network.length * 13 + 40}" height="52" rx="26" fill="${CYAN}"/>
  <text x="${W - 60 - (network.length * 13 + 40) / 2}" y="98" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="22" fill="${NAVY}" letter-spacing="0.5">${esc(network.toUpperCase())}</text>` : ''}

  ${hasPoster ? `<!-- accent bar above title -->
  <rect x="${titleX}" y="${yStart - 60}" width="120" height="4" fill="${CYAN}"/>` : `<rect x="${W/2 - 70}" y="${yStart - 60}" width="140" height="4" fill="${CYAN}"/>`}

  <!-- title -->
  ${titleSVG}

  <!-- tagline -->
  <text x="${titleX}" y="${yStart + lines.length * fontSize * 1.05 + 55}" text-anchor="${textAnchor}" font-family="${FONT}" font-weight="500" font-size="28" fill="${WHITE}" fill-opacity="0.7">${esc(tagline)}</text>

  <!-- bottom accent bar -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${CYAN}"/>
</svg>`;

  // Composite: base → blurred poster (if available) → SVG overlay → poster on the right
  const composites: sharp.OverlayOptions[] = [];

  let base: sharp.Sharp;
  if (posterBlurBuf) {
    base = sharp(posterBlurBuf);
  } else {
    base = sharp({ create: { width: W, height: H, channels: 3, background: NAVY } });
  }

  composites.push({ input: Buffer.from(svg), top: 0, left: 0 });

  if (posterBuf) {
    // Poster on the right side with drop shadow — pad for shadow
    composites.push({
      input: posterBuf,
      top: Math.round(H / 2 - 390),
      left: W - 520 - 120,
    });
  }

  return base.composite(composites).jpeg({ quality: 85, progressive: true, mozjpeg: true }).toBuffer();
}
