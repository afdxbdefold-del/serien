/**
 * /ads_tm.php — TheMoneytizer-Live-Merge-ads.txt
 *
 * TypeScript-Portierung des offiziellen TheMoneytizer-PHP-Snippets
 * (ads_tm.php). Zieht die aktuelle TheMoneytizer-Reseller-Liste live
 * und merged sie mit der lokalen ads.txt — dedupliziert, whitespace-
 * normalisiert, Komma-Space-formatiert.
 *
 * Warum als eigene Route und nicht direkt in /ads.txt gemerged:
 *  - Das offizielle PHP liegt bei allen TM-Publishern unter dem exakten
 *    Pfad /ads_tm.php. Ad-Verifier folgen dieser Konvention.
 *  - Unsere statische /ads.txt bleibt unverändert (predictable, cacheable,
 *    Rollback-fähig). Für dynamische Sync über TM nutzen Verifier gezielt
 *    /ads_tm.php.
 *
 * Route-Config:
 *  - dynamic='force-dynamic' (KEIN Static-Cache, sonst friert TM-Response
 *    beim Build ein)
 *  - revalidate=300 wäre theoretisch nett, aber TM ändert die Liste
 *    öfter — 5 Min Cache auf dem CDN reicht (siehe HEADERS).
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TheMoneytizer live-URL. Wichtig: `site_id=141665` ist die serien.de-
// Site-ID bei TheMoneytizer (verifiziert per direktem Aufruf →
// OWNERDOMAIN=serien.de). Das offiziell mitgelieferte PHP-Snippet hatte
// `site_id=141915` fest verdrahtet — das gehört zu einer FREMDEN Domain
// (mytickets.de). ID (=Publisher-ID) `131755` bleibt gleich.
const TMN_URL = 'https://ads.themoneytizer.com/ads_txt.php?site_id=141665&id=131755';

const HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain; charset=utf-8',
  // 5 Min Public-Cache am CDN; TheMoneytizer aktualisiert ihre Liste
  // typischerweise mehrmals pro Woche. Bei Ausfall liefert Cloudflare
  // 24 h die letzte Version aus (stale-while-revalidate).
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'X-Robots-Tag': 'all',
};

/**
 * PHP: `trim(str_replace(' ', '', $v))`
 * Removes ALL spaces (nicht nur trim!) — TheMoneytizer's Merge-Logik
 * normalisiert so, damit "google.com, pub-xxx" und "google.com,pub-xxx"
 * als gleiche Zeile behandelt werden.
 */
function normalizeLine(line: string): string {
  return line.replace(/\s+/g, '').trim();
}

/**
 * PHP: `str_replace(',', ', ', $v)` am Ende.
 * Fügt nach jedem Komma ein Leerzeichen ein für lesbaren Output.
 */
function prettify(line: string): string {
  return line.replace(/,/g, ', ');
}

async function fetchTmnAdsTxt(): Promise<string> {
  try {
    const res = await fetch(TMN_URL, {
      // 5-Sek-Timeout, damit ein langsamer TM-Server nicht die ganze
      // Route blockt. Bei Timeout fällt fetchTmnAdsTxt auf leere String
      // zurück und wir liefern nur die lokale ads.txt aus.
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
      headers: {
        'User-Agent': 'serien.de-ads-txt-sync/1.0',
        Accept: 'text/plain, */*',
      },
    });
    if (!res.ok) {
      console.warn(`[ads-tm] TMN upstream returned ${res.status}`);
      return '';
    }
    return await res.text();
  } catch (e: any) {
    console.warn('[ads-tm] TMN fetch failed:', e?.message || e);
    return '';
  }
}

async function fetchLocalAdsTxt(request: Request): Promise<string> {
  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/ads`, { cache: 'no-store' });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  const [localRaw, tmnRaw] = await Promise.all([
    fetchLocalAdsTxt(request),
    fetchTmnAdsTxt(),
  ]);

  // PHP-Logik nachgebaut: beide Listen normalisieren, mergen, dedupen,
  // leere Zeilen filtern, dann Komma-Space-Format anwenden.
  const localLines = localRaw.split('\n').map(normalizeLine);
  const tmnLines = tmnRaw.split('\n').map(normalizeLine);

  // PHP: array_unique(array_merge($aAdsTxtThemoneytizer, $aAdsTxt))
  // Reihenfolge: TMN-Liste zuerst, dann lokale — Dedup behält Erst-Position.
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of [...tmnLines, ...localLines]) {
    if (!line) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    merged.push(line);
  }

  const body = merged.map(prettify).join('\n');
  return new NextResponse(body, { status: 200, headers: HEADERS });
}

export async function HEAD(request: Request) {
  const [localRaw, tmnRaw] = await Promise.all([
    fetchLocalAdsTxt(request),
    fetchTmnAdsTxt(),
  ]);
  const localLines = localRaw.split('\n').map(normalizeLine);
  const tmnLines = tmnRaw.split('\n').map(normalizeLine);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of [...tmnLines, ...localLines]) {
    if (!line || seen.has(line)) continue;
    seen.add(line);
    merged.push(line);
  }
  const body = merged.map(prettify).join('\n');
  return new NextResponse(null, {
    status: 200,
    headers: { ...HEADERS, 'Content-Length': String(Buffer.byteLength(body, 'utf-8')) },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}
