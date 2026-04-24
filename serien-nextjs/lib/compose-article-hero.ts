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
 * Font-rendering strategy:
 *   Vercel's serverless runtime has no system fonts and sharp's librsvg does
 *   NOT honor `@font-face` with data-URL sources. So every <text> element
 *   is converted to a precomputed <path> via opentype.js at render time.
 *   This is fully deterministic — no fontconfig, no system dependencies.
 */
import sharp from 'sharp';
import { put } from '@vercel/blob';
import opentype from 'opentype.js';
import fontBlackB64 from './fonts/NotoSans-Black.base64';
import fontMediumB64 from './fonts/NotoSans-Medium.base64';

const CYAN = '#13bfe0';
const NAVY = '#062344';
const NAVY_DEEP = '#03152a';
const WHITE = '#ffffff';

// Cache fonts per process — loading a TTF is ~50ms, we don't want to redo
// it per article on a warm lambda.
let fontBlack: opentype.Font | null = null;
let fontMedium: opentype.Font | null = null;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, 'base64');
  // Return a fresh ArrayBuffer, not a view on pooled Buffer memory.
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

function loadFonts() {
  if (fontBlack && fontMedium) return;
  try {
    // Parse from bundled base64 data — works identically on every runtime
    // (Vercel serverless, Node dev, edge). Previously we tried loadSync()
    // against assets/fonts/ which is NOT shipped in the Vercel lambda
    // filesystem → fonts silently missing → tofu-boxes in the hero.
    fontBlack = opentype.parse(base64ToArrayBuffer(fontBlackB64));
    fontMedium = opentype.parse(base64ToArrayBuffer(fontMediumB64));
  } catch (err) {
    console.error('[compose-article-hero] font load failed:', (err as any)?.message);
  }
}

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

/**
 * Render a single line of text as an SVG <path>. The `y` value is the
 * baseline, matching how <text y=…> normally behaves, so existing layout
 * math stays valid.
 */
function textPath(
  font: opentype.Font | null,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  opts: {
    anchor?: 'start' | 'middle' | 'end';
    letterSpacing?: number;
    opacity?: number;
  } = {},
): string {
  if (!font) {
    // Last-resort fallback: system font text (may show tofu, but render attempts).
    const tw = text.length * fontSize * 0.55;
    const ax = opts.anchor === 'middle' ? x - tw / 2 : opts.anchor === 'end' ? x - tw : x;
    return `<text x="${ax}" y="${y}" font-family="sans-serif" font-size="${fontSize}" fill="${fill}"${opts.opacity != null ? ` fill-opacity="${opts.opacity}"` : ''}>${esc(text)}</text>`;
  }
  const letterSpacing = opts.letterSpacing ?? 0;

  // Pre-measure to enable anchor/alignment without re-laying out per glyph.
  // getAdvanceWidth doesn't account for our custom letter-spacing, so we
  // add it in manually.
  const base = font.getAdvanceWidth(text, fontSize);
  const totalWidth = base + Math.max(0, text.length - 1) * letterSpacing;
  const originX =
    opts.anchor === 'middle' ? x - totalWidth / 2 : opts.anchor === 'end' ? x - totalWidth : x;

  // If letter-spacing is 0, we can take the fast path — one getPath call.
  if (letterSpacing === 0) {
    const p = font.getPath(text, originX, y, fontSize);
    const d = p.toPathData(2);
    return `<path d="${d}" fill="${fill}"${opts.opacity != null ? ` fill-opacity="${opts.opacity}"` : ''}/>`;
  }

  // Otherwise, lay out glyphs manually to apply letter-spacing.
  const glyphs = font.stringToGlyphs(text);
  let cursor = originX;
  const parts: string[] = [];
  for (const g of glyphs) {
    const p = g.getPath(cursor, y, fontSize);
    parts.push(p.toPathData(2));
    cursor += (g.advanceWidth ?? 0) * (fontSize / font.unitsPerEm) + letterSpacing;
  }
  return `<path d="${parts.join(' ')}" fill="${fill}"${opts.opacity != null ? ` fill-opacity="${opts.opacity}"` : ''}/>`;
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

  // ---- layer 2: SVG overlay (gradient, dot pattern, text-as-paths)
  // Headline sizing logic: longer headlines get smaller text
  const headlineLen = headline.length;
  const fontSize = headlineLen <= 40 ? 105 : headlineLen <= 60 ? 82 : headlineLen <= 85 ? 64 : 52;
  const maxChars = headlineLen <= 40 ? 22 : headlineLen <= 60 ? 28 : headlineLen <= 85 ? 36 : 42;
  const lines = wrap(headline, maxChars).slice(0, 4);
  // Vertical layout — SVG path `y` = baseline (opentype origin). Kicker + bar
  // need ~fontSize worth of clearance above the first headline line.
  const kickerOffset = Math.round(fontSize * 0.95) + 18;
  const barOffset = kickerOffset + 40;
  const titleX = 120;
  const titleBlockHeight = lines.length * fontSize * 1.08;
  const rawTitleYStart = H - 200 - titleBlockHeight;
  const barTopIfUnshifted = rawTitleYStart - barOffset;
  const minBarTop = 220;
  const titleYStart = barTopIfUnshifted < minBarTop
    ? rawTitleYStart + (minBarTop - barTopIfUnshifted)
    : rawTitleYStart;

  const titleSVG = lines
    .map((l, i) =>
      textPath(fontBlack, l, titleX, titleYStart + i * fontSize * 1.08, fontSize, WHITE, {
        letterSpacing: -1.5,
      }),
    )
    .join('\n');

  // Top-right network badge
  const badgeText = network.toUpperCase();
  const badgeFontSize = 22;
  const badgeWidth = fontBlack
    ? fontBlack.getAdvanceWidth(badgeText, badgeFontSize) + Math.max(0, badgeText.length - 1) * 0.5 + 40
    : badgeText.length * 13 + 40;
  const badgeX = W - 60 - badgeWidth;
  const networkBadge = network
    ? `<rect x="${badgeX}" y="64" width="${badgeWidth}" height="52" rx="26" fill="${CYAN}"/>
       ${textPath(fontBlack, badgeText, badgeX + badgeWidth / 2, 98, badgeFontSize, NAVY, { anchor: 'middle', letterSpacing: 0.5 })}`
    : '';

  // Brand lockup
  const brandS = textPath(fontBlack, 's', 90, 106, 50, NAVY, { anchor: 'middle' });
  const brandWordmark = textPath(fontBlack, 'serien.de', 148, 104, 44, WHITE, { letterSpacing: -1 });

  // Category kicker
  const kickerPath = textPath(
    fontBlack,
    category.toUpperCase(),
    titleX,
    titleYStart - kickerOffset,
    26,
    CYAN,
    { letterSpacing: 2 },
  );

  // Series subline
  const sublinePath = seriesName
    ? textPath(fontMedium, seriesName, titleX, H - 130, 30, WHITE, { opacity: 0.75 })
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
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

  <rect width="${W}" height="${H}" fill="url(#readShade)"/>
  <rect width="${W}" height="${H}" fill="url(#accent)"/>
  ${hasImageBg ? '' : `<rect width="${W}" height="${H}" fill="url(#dots)"/>`}

  <circle cx="90" cy="90" r="36" fill="${CYAN}"/>
  ${brandS}
  ${brandWordmark}

  ${networkBadge}

  <rect x="${titleX}" y="${titleYStart - barOffset}" width="100" height="4" fill="${CYAN}"/>

  ${kickerPath}

  ${titleSVG}

  ${sublinePath}

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
    const blob = await put(blobPath, buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  } catch (err: any) {
    console.error('[composeAndStoreArticleHero] failed:', err?.message || err);
    return null;
  }
}
// Re-export BLOB_BASE usage so the constant stays in scope for potential external consumers
export const __BLOB_BASE = BLOB_BASE;
