/**
 * Generic TMDB image proxy.
 *
 * Route: /img/tmdb/<size>/<filename>
 * Proxies: https://image.tmdb.org/t/p/<size>/<filename>
 *
 * Purpose:
 *   Keeps all TMDB cast/person/poster images same-origin. Vercel's edge layer
 *   then caches them globally, so user browsers never hit image.tmdb.org
 *   directly after the first request per (size, filename).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// TMDB only supports these sizes; anything else → 400.
const ALLOWED_SIZES = new Set([
  'w45', 'w92', 'w154', 'w185', 'w300', 'w342', 'w500', 'w780', 'w1280',
  'h632', 'original',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!path || path.length < 2) {
    return new NextResponse('Bad request', { status: 400 });
  }

  const [size, ...rest] = path;
  if (!ALLOWED_SIZES.has(size)) {
    return new NextResponse('Unknown size', { status: 400 });
  }

  // Reject path traversal & odd characters
  const filename = rest.join('/');
  if (!/^[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
    return new NextResponse('Bad filename', { status: 400 });
  }

  const tmdbUrl = `https://image.tmdb.org/t/p/${size}/${filename}`;

  try {
    const upstream = await fetch(tmdbUrl, {
      // Let Node fetch transparently negotiate keep-alive.
      headers: { 'User-Agent': 'serien.de/1.0 (tmdb-proxy)' },
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
        // 1 day browser, 30 days CDN, stale-while-revalidate 7 days.
        // TMDB images are immutable (filename = hash), so we can be aggressive.
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800, immutable',
      },
    });
  } catch (err) {
    console.error('[tmdb-proxy]', tmdbUrl, err);
    return new NextResponse('Proxy error', { status: 502 });
  }
}
