/**
 * Admin "Facebook Status" Observability widget data (Pipeline-Health).
 *
 * GET /api/admin/facebook-status
 *   → Health-Check + Token-Expiry + Posts/Tag + App-Mode-Detection
 *
 * App-Mode-Detection:
 *   Wir crawlen die öffentliche Facebook-Page-URL als "facebookexternalhit/1.1"
 *   und prüfen, ob die letzten erfolgreich geposteten Artikel-Slugs im HTML
 *   auftauchen. Wenn NULL Treffer → App ist wahrscheinlich "Unpublished"
 *   (Development Mode) und Posts sind nur für App-Admins sichtbar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getFacebookTokenInfo } from '@/lib/facebook-poster';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Heuristische Erkennung ob die FB-App live oder unpublished ist.
 * Wir crawlen die öffentliche Page als FB-eigener Crawler und prüfen,
 * ob die letzten erfolgreichen Auto-Posts im HTML zu sehen sind.
 */
async function detectAppPublicVisibility(recentSlugs: string[]): Promise<{
  checked: boolean;
  publicVisible: boolean | null;
  htmlBytes: number;
  matchedSlugs: number;
  totalChecked: number;
  pageUrl: string;
  reason: string;
}> {
  const pageUrl = 'https://www.facebook.com/serien.de/';
  if (recentSlugs.length === 0) {
    return {
      checked: false,
      publicVisible: null,
      htmlBytes: 0,
      matchedSlugs: 0,
      totalChecked: 0,
      pageUrl,
      reason: 'Keine erfolgreichen Posts in DB zum Testen.',
    };
  }
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml',
      },
      // Cache busting + reasonable timeout via Next-fetch
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Suche nach den letzten 5 erfolgreichen Slugs im HTML
    const slice = recentSlugs.slice(0, 5);
    const matchedSlugs = slice.filter((s) => s && html.includes(s)).length;
    const publicVisible = matchedSlugs > 0;
    return {
      checked: true,
      publicVisible,
      htmlBytes: html.length,
      matchedSlugs,
      totalChecked: slice.length,
      pageUrl,
      reason: publicVisible
        ? `${matchedSlugs}/${slice.length} der letzten Posts im Public-HTML gefunden.`
        : `KEINER der letzten ${slice.length} Posts im Public-HTML – App vermutlich "Unveröffentlicht" (Development Mode).`,
    };
  } catch (e: any) {
    return {
      checked: false,
      publicVisible: null,
      htmlBytes: 0,
      matchedSlugs: 0,
      totalChecked: recentSlugs.length,
      pageUrl,
      reason: `Crawl-Fehler: ${e?.message || String(e)}`,
    };
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since24 = new Date(Date.now() - 24 * 3600_000);
  const since7d = new Date(Date.now() - 7 * 86400_000);

  const [tokenInfo, recent, success24, failed24, success7d, last5Success] = await Promise.all([
    getFacebookTokenInfo(),
    prisma.facebook_post_log.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        articleSlug: true,
        fbPostId: true,
        success: true,
        statusCode: true,
        errorMessage: true,
        trigger: true,
        createdAt: true,
      },
    }),
    prisma.facebook_post_log.count({
      where: { createdAt: { gte: since24 }, success: true },
    }),
    prisma.facebook_post_log.count({
      where: { createdAt: { gte: since24 }, success: false },
    }),
    prisma.facebook_post_log.findMany({
      where: { createdAt: { gte: since7d }, success: true },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.facebook_post_log.findMany({
      where: { success: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { articleSlug: true, fbPostId: true, createdAt: true },
    }),
  ]);

  // Tagesverteilung (letzte 7 Tage)
  const byDay = new Map<string, number>();
  for (const p of success7d) {
    const d = p.createdAt.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  const postsPerDay = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, count]) => ({ day, count }));

  // Token-Expiry in Tagen
  const tokenExpiresAt = tokenInfo.expiresAt ?? null;
  const tokenExpiryDays =
    tokenExpiresAt && tokenExpiresAt > 0
      ? Math.floor((tokenExpiresAt * 1000 - Date.now()) / 86400_000)
      : null;

  // App-Mode-Detection (Live vs Development/Unpublished)
  const visibility = await detectAppPublicVisibility(
    last5Success.map((p) => p.articleSlug).filter((s): s is string => !!s)
  );

  // Warnings ableiten
  const warnings: string[] = [];
  if (visibility.checked && visibility.publicVisible === false) {
    warnings.push(
      'App vermutlich "Unveröffentlicht" – nur App-Admins sehen Posts. Schalte auf "Live" im Developer Dashboard.'
    );
  }
  if (tokenExpiryDays !== null && tokenExpiryDays <= 7) {
    warnings.push(`Token läuft in ${tokenExpiryDays} Tag(en) ab – jetzt neu generieren!`);
  }
  if (!tokenInfo.valid) {
    warnings.push(`Token ungültig: ${tokenInfo.error || 'unbekannter Fehler'}`);
  }
  const avgPerDay =
    postsPerDay.length > 0
      ? postsPerDay.reduce((a, b) => a + b.count, 0) / postsPerDay.length
      : 0;
  if (avgPerDay > 20) {
    warnings.push(
      `Posting-Frequenz hoch: ⌀ ${avgPerDay.toFixed(0)}/Tag – FB drosselt Pages bei >20 Posts/Tag mit externen Links.`
    );
  }

  return NextResponse.json({
    tokenInfo: {
      valid: tokenInfo.valid,
      pageId: tokenInfo.pageId,
      pageName: tokenInfo.pageName,
      type: tokenInfo.type,
      scopes: tokenInfo.scopes,
      expiresAt: tokenExpiresAt,
      expiryDays: tokenExpiryDays,
      error: tokenInfo.error,
    },
    visibility,
    stats: {
      success24h: success24,
      failed24h: failed24,
      success7d: success7d.length,
      avgPerDay: Math.round(avgPerDay * 10) / 10,
    },
    postsPerDay,
    recent,
    warnings,
    quickLinks: {
      appDashboard: 'https://developers.facebook.com/apps/1658084615216819/dashboard/',
      appSettings: 'https://developers.facebook.com/apps/1658084615216819/settings/basic/',
      pageQuality: 'https://business.facebook.com/latest/page_quality?asset_id=100815118519738',
      accountCenter: 'https://accountscenter.facebook.com/profiles',
      tokenRefresh: 'https://developers.facebook.com/tools/explorer/',
    },
  });
}
