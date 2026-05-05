/**
 * ADMIN: Force-Kill-Article
 *
 * Ein-Klick-Lösung für durchgerutschte Boulevard-/Off-Topic-Artikel.
 *
 *   POST /api/admin/force-kill-article
 *   Body: {
 *     url: string,                  // Volle URL oder slug-Pfad
 *     addToBlocklist?: boolean,     // Default true
 *     blocklistKeywords?: string[], // Override; sonst aus Title abgeleitet
 *     blocklistReason?: string,     // Optional Begründung
 *   }
 *
 * Aktionen (atomar so weit wie möglich):
 *   1. Slug aus URL extrahieren.
 *   2. Artikel laden (für Title + linked Series).
 *   3. 301-Redirect in `redirects`-Tabelle (slug → /news).
 *   4. Optional: Title-Keyword + URL-Pattern + linked tmdbId in `blocklist_entries`.
 *   5. Artikel löschen.
 *   6. ISR-Cache purge: /, /news, /[slug].
 *
 * Auth: Bearer JWT (role=admin).
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { invalidateBlocklistCache } from '@/lib/series-blocklist';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'admin') return null;
    return String(payload.email || payload.username || 'admin');
  } catch {
    return null;
  }
}

/**
 * Extrahiert den slug aus URL-Varianten:
 *   https://serien.de/foo-bar-baz       → "foo-bar-baz"
 *   https://serien.de/foo-bar-baz/      → "foo-bar-baz"
 *   /foo-bar-baz                        → "foo-bar-baz"
 *   foo-bar-baz                         → "foo-bar-baz"
 */
function extractSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let pathname: string;
  try {
    if (trimmed.startsWith('http')) {
      const u = new URL(trimmed);
      pathname = u.pathname;
    } else {
      pathname = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
  } catch {
    pathname = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  const slug = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!slug || slug.includes('/')) return null; // article slugs haben keinen weiteren Slash
  return slug;
}

/**
 * Heuristik: leite 1-2 Title-Keywords aus dem Headline ab. Vermeidet Stopwords
 * und nimmt die längsten "wichtigen" Wörter. Beispiel:
 *   "Warum Today with Jenna & Sheinelle gerade so viele Zuschauer anspricht"
 *     → ["today with jenna"]  (Eigenname-Cluster)
 */
function deriveBlocklistKeyword(title: string): string {
  const stop = new Set([
    'warum', 'wie', 'wer', 'wo', 'wann', 'wieso', 'was', 'welche', 'welcher',
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'eines', 'für', 'mit', 'ohne', 'zur', 'zum', 'bei', 'aus', 'auf',
    'and', 'the', 'is', 'in', 'of', 'so', 'jetzt', 'gerade', 'nach', 'bei',
    'nochmal', 'wieder', 'doch', 'kein', 'keine', 'auch', 'noch', 'sehr',
    'viele', 'einige', 'alle', 'mehr', 'mehrere', 'man', 'ihr', 'sein', 'seine',
  ]);
  const words = title
    .replace(/[:,!?–—]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w.toLowerCase()));
  if (words.length === 0) return title.toLowerCase().slice(0, 40);

  // Take the first cluster of capitalized words (likely a proper noun / show name)
  const capCluster: string[] = [];
  for (const w of words) {
    if (/^[A-ZÄÖÜ]/.test(w)) {
      capCluster.push(w.toLowerCase());
      if (capCluster.length >= 4) break;
    } else if (capCluster.length > 0) {
      break;
    }
  }
  if (capCluster.length > 0) return capCluster.join(' ');
  return words.slice(0, 3).join(' ').toLowerCase();
}

interface ActionLog {
  step: string;
  ok: boolean;
  detail?: string;
}

export async function POST(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const slug = extractSlug(String(body.url || ''));
  if (!slug) {
    return NextResponse.json({ error: 'Konnte slug nicht aus URL extrahieren' }, { status: 400 });
  }

  const addToBlocklist = body.addToBlocklist !== false;
  const customKeywords: string[] | undefined = Array.isArray(body.blocklistKeywords)
    ? body.blocklistKeywords.filter((k: any) => typeof k === 'string' && k.trim().length > 1)
    : undefined;
  const customReason: string | undefined = typeof body.blocklistReason === 'string' ? body.blocklistReason : undefined;

  const log: ActionLog[] = [];

  // STEP 1: Artikel laden
  const article = await prisma.articles.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      article_series: { select: { series: { select: { tmdbId: true, name: true } } } },
    },
  });
  if (!article) {
    return NextResponse.json({ error: `Artikel nicht gefunden: /${slug}` }, { status: 404 });
  }

  // STEP 2: 301-Redirect (idempotent)
  try {
    await prisma.redirects.upsert({
      where: { fromPath: `/${slug}` },
      update: { toPath: '/news', type: 301 },
      create: { fromPath: `/${slug}`, toPath: '/news', type: 301 },
    });
    log.push({ step: 'redirect-301', ok: true, detail: `/${slug} → /news` });
  } catch (e: any) {
    log.push({ step: 'redirect-301', ok: false, detail: e?.message || 'redirect upsert failed' });
  }

  // STEP 3: Blocklist (optional)
  if (addToBlocklist) {
    const keywords = customKeywords && customKeywords.length > 0
      ? customKeywords.map((k) => k.toLowerCase().trim())
      : [deriveBlocklistKeyword(article.title)];
    const tmdbIds = article.article_series
      .map((s) => s.series?.tmdbId)
      .filter((id): id is number => typeof id === 'number');
    const seriesNames = article.article_series
      .map((s) => s.series?.name)
      .filter((n): n is string => typeof n === 'string')
      .slice(0, 1);
    const label = seriesNames[0] ? `Force-Kill: ${seriesNames[0]}` : `Force-Kill: ${keywords[0]}`;
    try {
      await prisma.blocklist_entries.create({
        data: {
          label,
          titleKeywords: keywords,
          urlPatterns: [keywords[0].replace(/\s+/g, '-')],
          tmdbIds,
          enabled: true,
          note: customReason || `Per Admin Force-Kill durch ${user} am ${new Date().toISOString()}.`,
        },
      });
      invalidateBlocklistCache();
      log.push({ step: 'blocklist-add', ok: true, detail: `${label} | keywords=${JSON.stringify(keywords)} | tmdbIds=${JSON.stringify(tmdbIds)}` });
    } catch (e: any) {
      log.push({ step: 'blocklist-add', ok: false, detail: e?.message || 'create failed' });
    }
  }

  // STEP 4: Artikel löschen
  try {
    await prisma.articles.delete({ where: { id: article.id } });
    log.push({ step: 'delete-article', ok: true, detail: `id=${article.id}` });
  } catch (e: any) {
    log.push({ step: 'delete-article', ok: false, detail: e?.message || 'delete failed' });
    // bewusst nicht abbrechen — Redirect/Blocklist sind schon drin, manueller Cleanup möglich
  }

  // STEP 5: ISR-Cache purgen
  const pathsToPurge = ['/', '/news', `/${slug}`];
  const purgedOk: string[] = [];
  const purgeErrors: string[] = [];
  for (const p of pathsToPurge) {
    try {
      revalidatePath(p, 'page');
      purgedOk.push(p);
    } catch (e: any) {
      purgeErrors.push(`${p}: ${e?.message || 'failed'}`);
    }
  }
  log.push({ step: 'isr-purge', ok: purgeErrors.length === 0, detail: `purged=${purgedOk.length} errors=${purgeErrors.length}` });

  return NextResponse.json({
    ok: true,
    slug,
    title: article.title,
    user,
    actions: log,
    purged: purgedOk,
    purgeErrors,
  });
}
