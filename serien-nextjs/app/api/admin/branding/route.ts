/**
 * BRANDING ASSET MANAGEMENT API
 *
 * GET  /api/admin/branding              — list all managed logo slots with current file info
 * POST /api/admin/branding?slot=<id>    — upload new file for a slot (multipart/form-data, field "file")
 * DELETE /api/admin/branding?slot=<id>  — delete current file (reverts to missing state)
 *
 * All writes go into /app/serien-nextjs/public/ and, where needed,
 * /app/serien-nextjs/app/ (App-Router favicon convention).
 *
 * Auth: Bearer JWT with role=admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { payload } = await jwtVerify(auth.substring(7), JWT_SECRET);
    return payload.role === 'admin';
  } catch { return false; }
}

// ──────────────────────────────────────────────────────────────────────
// SLOTS — what branding assets we manage
// ──────────────────────────────────────────────────────────────────────
interface Slot {
  id: string;
  label: string;
  description: string;
  publicPath: string;         // relative to /public (e.g. "og-image.png")
  mirrorAppPath?: string;     // also write to /app (App-Router icon convention)
  recommendedWidth: number;
  recommendedHeight: number;
  recommendedNote: string;
  acceptedMimes: string[];
  acceptedExts: string[];
  maxSizeBytes: number;
}

const SLOTS: Slot[] = [
  {
    id: 'favicon',
    label: 'Favicon',
    description: 'Browser-Tab-Icon. Idealerweise Multi-Size-ICO (16+32+48), moderne Browser nutzen 32×32 für Retina.',
    publicPath: 'favicon-v2.ico',
    mirrorAppPath: 'favicon.ico',
    recommendedWidth: 48, recommendedHeight: 48,
    recommendedNote: 'ICO (16+32+48) oder 48×48 PNG',
    acceptedMimes: ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png'],
    acceptedExts: ['.ico', '.png'],
    maxSizeBytes: 200 * 1024,
  },
  {
    id: 'apple-touch',
    label: 'Apple Touch Icon',
    description: 'Home-Screen-Icon auf iOS. Fixe Größe 180×180, PNG mit transparentem oder farbigem Hintergrund.',
    publicPath: 'apple-touch-icon.png',
    mirrorAppPath: 'apple-icon.png',
    recommendedWidth: 180, recommendedHeight: 180,
    recommendedNote: '180×180 PNG',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 500 * 1024,
  },
  {
    id: 'icon-192',
    label: 'PWA Icon 192',
    description: 'Android Home-Screen / PWA. 192×192 PNG.',
    publicPath: 'icon-192.png',
    recommendedWidth: 192, recommendedHeight: 192,
    recommendedNote: '192×192 PNG',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 500 * 1024,
  },
  {
    id: 'icon-512',
    label: 'PWA Icon 512',
    description: 'Splash-Screen / PWA Manifest. 512×512 PNG.',
    publicPath: 'icon-512.png',
    recommendedWidth: 512, recommendedHeight: 512,
    recommendedNote: '512×512 PNG',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 1024 * 1024,
  },
  {
    id: 'og-image',
    label: 'Social Share Bild (Open Graph)',
    description: 'Facebook / LinkedIn / WhatsApp Link-Preview (Light). 1200×630 ist der Standard (1.91:1).',
    publicPath: 'og-image.png',
    recommendedWidth: 1200, recommendedHeight: 630,
    recommendedNote: '1200×630 PNG oder JPG',
    acceptedMimes: ['image/png', 'image/jpeg'],
    acceptedExts: ['.png', '.jpg', '.jpeg'],
    maxSizeBytes: 2 * 1024 * 1024,
  },
  {
    id: 'og-image-dark',
    label: 'Social Share Bild (Dark Mode)',
    description: 'Alternative für Apps im Dark Mode / Threads / Mastodon. Gleiche Größe wie og-image.',
    publicPath: 'og-image-dark.png',
    recommendedWidth: 1200, recommendedHeight: 630,
    recommendedNote: '1200×630 PNG oder JPG',
    acceptedMimes: ['image/png', 'image/jpeg'],
    acceptedExts: ['.png', '.jpg', '.jpeg'],
    maxSizeBytes: 2 * 1024 * 1024,
  },
  {
    id: 'twitter-card',
    label: 'Twitter / X Card',
    description: 'Summary Large Image auf X / Twitter. 1200×600 (2:1) — anderes Verhältnis als Facebook.',
    publicPath: 'twitter-card.png',
    recommendedWidth: 1200, recommendedHeight: 600,
    recommendedNote: '1200×600 PNG oder JPG',
    acceptedMimes: ['image/png', 'image/jpeg'],
    acceptedExts: ['.png', '.jpg', '.jpeg'],
    maxSizeBytes: 2 * 1024 * 1024,
  },
  {
    id: 'logo',
    label: 'Publisher-Logo (Google News)',
    description: 'Google-News & NewsArticle Publisher-Logo. 1200×200 horizontal, transparenter PNG-Hintergrund. Google verlangt mindestens 112px Höhe — kleinere Logos werden ignoriert.',
    publicPath: 'logo.png',
    recommendedWidth: 1200, recommendedHeight: 200,
    recommendedNote: '1200×200 PNG mit Transparenz (min. 112px Höhe, ≥600px Breite)',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 500 * 1024,
  },
  {
    id: 'logo-white',
    label: 'Publisher-Logo (Dark Mode)',
    description: 'Logo-Variante für dunkle Hintergründe (Footer, Dark Mode, OG-Overlay). Weißer Text auf transparent, gleiche Dimensionen wie Light-Variante.',
    publicPath: 'logo-white.png',
    recommendedWidth: 1200, recommendedHeight: 200,
    recommendedNote: '1200×200 PNG mit Transparenz',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 500 * 1024,
  },
  {
    id: 'logo-square',
    label: 'Square Brand Image (Google News App)',
    description: 'Google News App Feed-Cards, NewsMediaOrganization.image, Social-Profile-Avatar. 1024×1024 ist der Standard seit 2024.',
    publicPath: 'logo-square.png',
    recommendedWidth: 1024, recommendedHeight: 1024,
    recommendedNote: '1024×1024 PNG (opak oder transparent)',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 2 * 1024 * 1024,
  },
  {
    id: 'icon-maskable',
    label: 'PWA Maskable Icon',
    description: 'Android-PWA-Icon mit Safe-Zone (80%). Android beschneidet zu Kreis/Squircle.',
    publicPath: 'icon-maskable-512.png',
    recommendedWidth: 512, recommendedHeight: 512,
    recommendedNote: '512×512 PNG (wichtiger Content im zentralen 80%)',
    acceptedMimes: ['image/png'],
    acceptedExts: ['.png'],
    maxSizeBytes: 1024 * 1024,
  },
];

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const APP_DIR    = path.resolve(process.cwd(), 'app');

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────
async function readFileMeta(fullPath: string) {
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return null;
    let width: number | null = null;
    let height: number | null = null;
    try {
      const meta = await sharp(fullPath).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      // ICO, SVG etc. — sharp can't read — fall back to null
    }
    return {
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      width,
      height,
    };
  } catch {
    return null;
  }
}

async function describeSlot(slot: Slot) {
  const publicFull = path.join(PUBLIC_DIR, slot.publicPath);
  const meta = await readFileMeta(publicFull);
  const sizeOk    = !meta || (meta.width === null) ||
    (meta.width === slot.recommendedWidth && meta.height === slot.recommendedHeight);
  return {
    id: slot.id,
    label: slot.label,
    description: slot.description,
    publicPath: '/' + slot.publicPath,
    recommendedWidth: slot.recommendedWidth,
    recommendedHeight: slot.recommendedHeight,
    recommendedNote: slot.recommendedNote,
    acceptedExts: slot.acceptedExts,
    maxSizeBytes: slot.maxSizeBytes,
    exists: !!meta,
    current: meta,
    sizeMatchesRecommendation: sizeOk,
  };
}

// ──────────────────────────────────────────────────────────────────────
// HANDLERS
// ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const slots = await Promise.all(SLOTS.map(describeSlot));
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const slotId = new URL(req.url).searchParams.get('slot');
  const slot = SLOTS.find((s) => s.id === slotId);
  if (!slot) return NextResponse.json({ error: 'Unknown slot' }, { status: 400 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file in "file" field' }, { status: 400 });

  if (file.size > slot.maxSizeBytes) {
    return NextResponse.json({ error: `File too large (max ${Math.round(slot.maxSizeBytes/1024)} KB)` }, { status: 413 });
  }
  if (!slot.acceptedMimes.includes(file.type)) {
    return NextResponse.json({ error: `Invalid MIME type ${file.type}. Accepted: ${slot.acceptedExts.join(', ')}` }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Validate dimensions for raster formats (not ICO/SVG)
  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    try {
      const meta = await sharp(buf).metadata();
      // warn (not reject) if dimensions off
      if (meta.width && meta.height) {
        if (meta.width !== slot.recommendedWidth || meta.height !== slot.recommendedHeight) {
          // Allow but inform the client
          console.warn(`[branding] slot=${slot.id} uploaded ${meta.width}x${meta.height}, expected ${slot.recommendedWidth}x${slot.recommendedHeight}`);
        }
      }
    } catch {
      return NextResponse.json({ error: 'Could not decode image' }, { status: 400 });
    }
  }

  const publicFull = path.join(PUBLIC_DIR, slot.publicPath);
  await fs.writeFile(publicFull, buf);
  if (slot.mirrorAppPath) {
    const appFull = path.join(APP_DIR, slot.mirrorAppPath);
    await fs.writeFile(appFull, buf);
  }

  const desc = await describeSlot(slot);
  return NextResponse.json({ ok: true, slot: desc });
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const slotId = new URL(req.url).searchParams.get('slot');
  const slot = SLOTS.find((s) => s.id === slotId);
  if (!slot) return NextResponse.json({ error: 'Unknown slot' }, { status: 400 });

  const publicFull = path.join(PUBLIC_DIR, slot.publicPath);
  await fs.rm(publicFull, { force: true });
  if (slot.mirrorAppPath) {
    const appFull = path.join(APP_DIR, slot.mirrorAppPath);
    await fs.rm(appFull, { force: true });
  }

  return NextResponse.json({ ok: true, slot: await describeSlot(slot) });
}
