/**
 * Legacy trailer proxy for objects that have not yet been migrated to R2.
 * New trailer records contain a public R2 URL and do not use this route.
 */

import { NextRequest, NextResponse } from 'next/server';

const STORAGE_URL = 'https://integrations.emergentagent.com/objstore/api/v1/storage';
const MAX_TRAILER_BYTES = 64 * 1024 * 1024;
const RANGE_CHUNK_BYTES = 1024 * 1024;

let storageKey: string | null = null;
let storageKeyExpiry = 0;

async function initStorage(): Promise<string> {
  const now = Date.now();
  if (storageKey && storageKeyExpiry > now) return storageKey;

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) throw new Error('Legacy trailer storage is not configured');

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });
  if (!response.ok) throw new Error(`Storage initialization failed (${response.status})`);

  const data = (await response.json()) as { storage_key?: unknown };
  if (typeof data.storage_key !== 'string' || !data.storage_key) {
    throw new Error('Storage initialization returned no key');
  }

  storageKey = data.storage_key;
  storageKeyExpiry = now + 50 * 60 * 1000;
  return storageKey;
}

function resolveStoragePath(parts: string[]): string | null {
  if (parts.length === 0 || parts.length > 12) return null;
  if (parts.some((part) => !part || part === '.' || part === '..' || !/^[a-zA-Z0-9._-]+$/.test(part))) {
    return null;
  }

  const path = parts.join('/');
  const allowedPrefix = path.startsWith('trailers/') || path.startsWith('serien-nextjs/trailers/');
  if (!allowedPrefix || !path.toLowerCase().endsWith('.mp4') || path.length > 300) return null;
  return path;
}

function normalizeRange(value: string | null): string | null {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value.trim());
  if (!match) return null;

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : start + RANGE_CHUNK_BYTES - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return null;
  }

  const end = Math.min(requestedEnd, start + RANGE_CHUNK_BYTES - 1);
  return `bytes=${start}-${end}`;
}

async function fetchObject(
  storagePath: string,
  options: { method?: 'GET' | 'HEAD'; range?: string | null } = {},
): Promise<Response> {
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const execute = async (key: string) => fetch(`${STORAGE_URL}/objects/${encodedPath}`, {
    method: options.method ?? 'GET',
    headers: {
      'X-Storage-Key': key,
      ...(options.range ? { Range: options.range } : {}),
    },
  });

  let response = await execute(await initStorage());
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    storageKey = null;
    response = await execute(await initStorage());
  }
  return response;
}

function parseContentLength(response: Response): number | null {
  const value = Number(response.headers.get('content-length'));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function limitedBody(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let bytesRead = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_TRAILER_BYTES) {
        await reader.cancel('Trailer exceeds proxy size limit');
        controller.error(new Error('Trailer exceeds proxy size limit'));
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function responseHeaders(upstream: Response): Headers {
  const contentType = upstream.headers.get('content-type');
  const headers = new Headers({
    'Content-Type': contentType?.startsWith('video/') ? contentType : 'video/mp4',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'X-Content-Type-Options': 'nosniff',
  });

  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const storagePath = resolveStoragePath((await context.params).path);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid trailer path' }, { status: 400 });
    }

    const requestedRange = request.headers.get('range');
    const range = normalizeRange(requestedRange);
    if (requestedRange && !range) {
      return new NextResponse('Range Not Satisfiable', { status: 416 });
    }

    const upstream = await fetchObject(storagePath, { range });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const contentLength = parseContentLength(upstream);
    if (contentLength !== null && contentLength > MAX_TRAILER_BYTES) {
      await upstream.body.cancel();
      return NextResponse.json({ error: 'Video exceeds proxy size limit' }, { status: 413 });
    }

    // Pass through a real upstream 206 response. If legacy storage ignores
    // Range and returns 200, stream the object instead of buffering it in RAM.
    const status = upstream.status === 206 ? 206 : 200;
    return new NextResponse(limitedBody(upstream.body), {
      status,
      headers: responseHeaders(upstream),
    });
  } catch (error: unknown) {
    console.error('Trailer proxy error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Trailer proxy unavailable' }, { status: 502 });
  }
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const storagePath = resolveStoragePath((await context.params).path);
    if (!storagePath) return new NextResponse(null, { status: 400 });

    // Prefer HEAD. Some legacy objects only support GET; in that case read
    // headers and cancel the body immediately rather than buffering the file.
    let upstream = await fetchObject(storagePath, { method: 'HEAD' });
    if (upstream.status === 405) {
      await upstream.body?.cancel();
      upstream = await fetchObject(storagePath);
    }
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return new NextResponse(null, { status: 404 });
    }

    const contentLength = parseContentLength(upstream);
    await upstream.body?.cancel();
    if (contentLength !== null && contentLength > MAX_TRAILER_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    return new NextResponse(null, { status: 200, headers: responseHeaders(upstream) });
  } catch (error: unknown) {
    console.error('Trailer HEAD error:', error instanceof Error ? error.message : error);
    return new NextResponse(null, { status: 502 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    },
  });
}
