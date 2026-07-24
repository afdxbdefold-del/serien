/**
 * ADMIN: Karteileichen-Serien entfernen.
 *
 * Löscht alle `series`-Zeilen ohne verknüpfte Artikel. Cascade-Deletes über
 * article_series, characters, episodes, push_subscriptions greifen automatisch
 * (schema.prisma: onDelete: Cascade).
 *
 *   GET  → Dry-Run: liefert Count + Sample. Löscht NICHTS.
 *   POST → Löschen. Body: { confirm: true }
 *
 * Auth: Bearer JWT (role=admin).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

/** Find all series with 0 articles (direct + junction). */
async function findEmptySeries() {
  // Alle Serien mit tmdbId ohne Article-Referenzen (weder als primarySeriesId
  // noch über article_series).
  return prisma.series.findMany({
    where: {
      articles: { none: {} },        // primarySeriesId → 0 articles
      article_series: { none: {} },  // Junction → 0 Referenzen
    },
    select: {
      tmdbId: true,
      slug: true,
      name: true,
      title: true,
      popularity: true,
      tmdbType: true,
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const empty = await findEmptySeries();
  return NextResponse.json({
    dryRun: true,
    count: empty.length,
    sample: empty.slice(0, 20).map((s) => ({
      tmdbId: s.tmdbId,
      slug: s.slug,
      name: s.name || s.title,
      popularity: s.popularity,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // no body → treat as unconfirmed
  }

  if (body?.confirm !== true) {
    return NextResponse.json(
      { error: 'confirm=true erforderlich im Body' },
      { status: 400 }
    );
  }

  const empty = await findEmptySeries();
  const idsToDelete = empty.map((s) => s.tmdbId);

  if (idsToDelete.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: 'Keine leeren Serien vorhanden.' });
  }

  // Batchweise löschen (Prisma bricht bei sehr grossen IN-Listen ab).
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += BATCH) {
    const chunk = idsToDelete.slice(i, i + BATCH);
    const res = await prisma.series.deleteMany({
      where: { tmdbId: { in: chunk } },
    });
    deleted += res.count;
  }

  return NextResponse.json({
    ok: true,
    deleted,
    by: user,
    at: new Date().toISOString(),
  });
}
