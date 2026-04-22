/**
 * ARTICLE HERO COMPOSER
 *
 * Generates a 1920×1080 branded hero image per-article for cases where the
 * TMDB backdrop alone isn't good enough (new shows, movies, creator-focused
 * stories). Composites:
 *
 *   [ blurred + darkened backdrop / poster / solid gradient ]
 *   + accent gradient + dot pattern
 *   + serien.de lockup (top-left)
 *   + network badge (top-right, optional)
 *   + accent bar + HEADLINE (left, prominent)
 *   + series name + category tagline (below headline)
 *   + bottom accent bar
 *
 * Output: JPEG Buffer (1920×1080, mozjpeg Q85).
 *
 * Integration: called from the pipeline's hero-resolver AFTER the TMDB
 * backdrop cascade has run and nothing was found. Result is uploaded to
 * Vercel Blob and the URL is stored as `articles.heroImageUrl`.
 */
import sharp from 'sharp';
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const CYAN = '#13bfe0';
const NAVY = '#062344';
const NAVY_DEEP = '#03152a';
const WHITE = '#ffffff';
// Vercel's serverless runtime does not ship Liberation/FreeSans/Arial, so we
// embed Noto Sans directly into the SVG via @font-face base64. This keeps the
// composite reproducible and avoids tofu boxes on cold starts.
let fontBlackB64: string | null = null;
let fontMediumB64: string | null = null;
function loadFonts() {
  if (fontBlackB64 && fontMediumB64) return;
  try {
    const root = path.join(process.cwd(), 'assets', 'fonts');
    fontBlackB64 = fs.readFileSync(path.join(root, 'NotoSans-Black.ttf')).toString('base64');
    fontMediumB64 = fs.readFileSync(path.join(root, 'NotoSans-Medium.ttf')).toString('base64');
  } catch (err) {
    console.error('[compose-article-hero] font load failed:', (err as any)?.message);
  }
}
const FONT = 'NotoSansEmbed, sans-serif';
const BLOB_BASE = process.env.BLOB_PUBLIC_URL || process.env.NEXT_PUBLIC_BLOB_URL || '';

function esc(s: string): string {
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

export interface ComposeHeroInput {
  headline: string;
  seriesName: string;
  /** TMDB backdrop path (e.g. "/abc.jpg") — takes priority if given */
  backdropPath?: string | null;
  /** TMDB poster path — fallback when no backdrop */
  posterPath?: string | null;
  /** First matching network ("Netflix", "Amazon Prime", …) for top-right badge */
  network?: string | null;
  /** One-line category tagline (e.g. "Casting News", "Staffel-News") */
  category?: string | null;
}

export async function composeArticleHero(input: ComposeHeroInput): Promise<Buffer> {
  loadFonts();
  const W = 1920;
  const H = 1080;
  const headline = (input.headline || '').trim();
  const seriesName = (input.seriesName || '').trim();
  const network = (input.network || '').trim();
  const category = (input.category || 'News').trim();

  // ---- layer 1: background (blurred backdrop > blurred poster > gradient)
  let bgBuf: Buffer | null = null;
  const fetchTmdb = async (path: string, size: string): Promise<Buffer | null> => {
    try {
      const url = `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    }
  };

  if (input.backdropPath) {
    const raw = await fetchTmdb(input.backdropPath, 'w1280');
    if (raw) {
      bgBuf = await sharp(raw)
        .resize(W, H, { fit: 'cover', position: 'center' })
        .blur(12)
        .modulate({ brightness: 0.45, saturation: 0.75 })
        .jpeg({ quality: 82 })
        .toBuffer();
    }
  }
  if (!bgBuf && input.posterPath) {
    const raw = await fetchTmdb(input.posterPath, 'w500');
    if (raw) {
      bgBuf = await sharp(raw)
        .resize(W, H, { fit: 'cover', position: 'center' })
        .blur(60)
        .modulate({ brightness: 0.3, saturation: 0.7 })
        .jpeg({ quality: 78 })
        .toBuffer();
    }
  }
  const hasImageBg = bgBuf !== null;

  // ---- layer 2: SVG overlay (gradient, dot pattern, text)
  // Headline sizing logic: longer headlines get smaller text
  const headlineLen = headline.length;
  const fontSize = headlineLen <= 40 ? 105 : headlineLen <= 60 ? 82 : headlineLen <= 85 ? 64 : 54;
  const maxChars = headlineLen <= 40 ? 24 : headlineLen <= 60 ? 32 : headlineLen <= 85 ? 40 : 46;
  const lines = wrap(headline, maxChars).slice(0, 4);
  const titleX = 120;
  const titleBlockHeight = lines.length * fontSize * 1.08;
  const titleYStart = H - 200 - titleBlockHeight;

  const titleSVG = lines
    .map(
      (l, i) =>
        `<text x="${titleX}" y="${titleYStart + i * fontSize * 1.08}" text-anchor="start" font-family="${FONT}" font-weight="900" font-size="${fontSize}" fill="${WHITE}" letter-spacing="-1.5">${esc(l)}</text>`,
    )
    .join('\n');

  const networkBadge = network
    ? `<rect x="${W - 60 - (network.length * 13 + 40)}" y="64" width="${network.length * 13 + 40}" height="52" rx="26" fill="${CYAN}"/>
       <text x="${W - 60 - (network.length * 13 + 40) / 2}" y="98" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="22" fill="${NAVY}" letter-spacing="0.5">${esc(network.toUpperCase())}</text>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'NotoSansEmbed';
        font-weight: 900;
        src: url(data:font/ttf;base64,${fontBlackB64 || ''}) format('truetype');
      }
      @font-face {
        font-family: 'NotoSansEmbed';
        font-weight: 500;
        src: url(data:font/ttf;base64,${fontMediumB64 || ''}) format('truetype');
      }
    ]]></style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <linearGradient id="readShade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${NAVY_DEEP}" stop-opacity="0.95"/>
      <stop offset="0.35" stop-color="${NAVY_DEEP}" stop-opacity="0.75"/>
      <stop offset="0.65" stop-color="${NAVY_DEEP}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${NAVY_DEEP}" stop-opacity="0.05"/>
    </linearGradient>
    <radialGradient id="accent" cx="0.15" cy="0.85" r="0.6">
      <stop offset="0" stop-color="${CYAN}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
      <circle cx="30" cy="30" r="1.2" fill="${CYAN}" fill-opacity="0.12"/>
    </pattern>
  </defs>

  ${hasImageBg ? '' : `<rect width="${W}" height="${H}" fill="url(#bg)"/>`}

  <!-- bottom-to-top dark gradient for headline legibility -->
  <rect width="${W}" height="${H}" fill="url(#readShade)"/>
  <rect width="${W}" height="${H}" fill="url(#accent)"/>
  ${hasImageBg ? '' : `<rect width="${W}" height="${H}" fill="url(#dots)"/>`}

  <!-- brand lockup top-left -->
  <circle cx="90" cy="90" r="36" fill="${CYAN}"/>
  <text x="90" y="106" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="50" fill="${NAVY}">s</text>
  <text x="148" y="104" font-family="${FONT}" font-weight="800" font-size="44" fill="${WHITE}" letter-spacing="-1">serien.de</text>

  ${networkBadge}

  <!-- accent bar above headline -->
  <rect x="${titleX}" y="${titleYStart - 60}" width="100" height="4" fill="${CYAN}"/>

  <!-- category kicker -->
  <text x="${titleX}" y="${titleYStart - 22}" font-family="${FONT}" font-weight="800" font-size="26" fill="${CYAN}" letter-spacing="2">${esc(category.toUpperCase())}</text>

  <!-- HEADLINE -->
  ${titleSVG}

  <!-- series subline -->
  ${
    seriesName
      ? `<text x="${titleX}" y="${H - 130}" font-family="${FONT}" font-weight="500" font-size="30" fill="${WHITE}" fill-opacity="0.75">${esc(seriesName)}</text>`
      : ''
  }

  <!-- bottom accent bar -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${CYAN}"/>
</svg>`;

  const base = bgBuf
    ? sharp(bgBuf)
    : sharp({ create: { width: W, height: H, channels: 3, background: NAVY } });

  return base
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer();
}

/**
 * Compose + upload to Vercel Blob. Returns the public URL (or null on failure).
 * Blob path is deterministic per articleId, so repeat runs overwrite rather than
 * fill the bucket with orphans.
 */
export async function composeAndStoreArticleHero(
  articleId: string,
  input: ComposeHeroInput,
): Promise<string | null> {
  try {
    const buf = await composeArticleHero(input);
    const blobPath = `articles/${articleId}/hero.jpg`;
    try {
      const blob = await put(blobPath, buf, { access: 'public', addRandomSuffix: false });
      return blob.url;
    } catch (err: any) {
      if (err?.message?.includes('already exists') && BLOB_BASE) {
        return `${BLOB_BASE}/${blobPath}`;
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[composeAndStoreArticleHero] failed:', err?.message || err);
    return null;
  }
}
