import type { PrismaClient } from '@prisma/client';
import type { CacheInvalidationDependencies, PublishedArticleInput, PublishedArticleVerification } from './publication-verification';

interface RecoveryDependencies {
  invalidate?: CacheInvalidationDependencies['invalidate'];
  verify?: (input: PublishedArticleInput) => Promise<PublishedArticleVerification>;
  refresh?: (slug: string, deps: CacheInvalidationDependencies) => Promise<unknown>;
  now?: number;
}

/** Retry visibility, never generation/publication, for committed article rows. */
export async function recoverPendingNewsPublications(prisma: PrismaClient, deps: RecoveryDependencies = {}) {
  const now = deps.now ?? Date.now();
  const result = { recovered: 0, pending: 0, checked: 0 };
  const withPendingCount = async () => {
    // Aggregate in PostgreSQL: do not load an unbounded run history just to
    // report a count. Cooldown, scan cap and the 36h recheck window must not
    // hide older or deferred committed publications that still need attention.
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT run."articleId") AS count
      FROM pipeline_runs AS run
      INNER JOIN articles AS article ON article.id = run."articleId"
      WHERE run.pipeline = 'pipeline-v2' AND run.trigger = 'cron'
        AND run.status = 'partial' AND run."errorStep" = 'publication-verification'
        AND article.status IN ('published', 'PUBLISHED')
    `;
    result.pending = Number(rows[0]?.count || 0);
    return result;
  };
  const runs = await prisma.pipeline_runs.findMany({
    where: { pipeline: 'pipeline-v2', trigger: 'cron', status: 'partial',
      errorStep: 'publication-verification', articleId: { not: null },
      startedAt: { gte: new Date(now - 36 * 60 * 60_000) } },
    orderBy: { completedAt: 'asc' }, take: 12,
    select: { id: true, articleId: true, metadata: true },
  });
  if (!runs.length) return withPendingCount();
  const { revalidatePublicationCaches, verifyPublishedArticle } = await import('./publication-verification');
  const refresh = deps.refresh || revalidatePublicationCaches;
  const verify = deps.verify || verifyPublishedArticle;
  const latest = await prisma.articles.findMany({
    where: { status: { in: ['published', 'PUBLISHED'] }, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' }, take: 40, select: { id: true, primarySeriesId: true },
  });
  // Match app/page.tsx's one-story-per-series homepage selection before the
  // client's first-five carousel split. Superseded stories are canonical-only.
  const carouselIds = new Set<string>();
  const seenSeries = new Set<number>();
  for (const article of latest) {
    if (article.primarySeriesId != null) {
      if (seenSeries.has(article.primarySeriesId)) continue;
      seenSeries.add(article.primarySeriesId);
    }
    carouselIds.add(article.id);
    if (carouselIds.size === 5) break;
  }
  const seenIds = new Set<string>();
  for (const run of runs) {
    if (result.checked >= 3) break;
    if (!run.articleId || seenIds.has(run.articleId)) continue;
    seenIds.add(run.articleId);
    let metadata: Record<string, unknown> = {};
    try {
      const value: unknown = JSON.parse(run.metadata || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) metadata = value as Record<string, unknown>;
    } catch { /* old malformed metadata must not block recovery */ }
    const lastCheckedAt = typeof metadata.publicationRecheckedAt === 'string'
      ? Date.parse(metadata.publicationRecheckedAt) : NaN;
    if (Number.isFinite(lastCheckedAt) && now - lastCheckedAt < 15 * 60_000) continue;
    const article = await prisma.articles.findUnique({
      where: { id: run.articleId }, select: { id: true, slug: true, title: true, heroImageUrl: true, status: true },
    });
    if (!article || !['published', 'PUBLISHED'].includes(article.status)) continue;
    result.checked++;
    let verification: PublishedArticleVerification;
    try {
      await refresh(article.slug, { invalidate: deps.invalidate });
      const inCarousel = carouselIds.has(article.id);
      verification = await verify({ slug: article.slug, title: article.title, heroImageUrl: article.heroImageUrl || '',
        expectedOnHomepage: inCarousel, expectedInNews: inCarousel,
        expectedCarousel: inCarousel ? 'present' : undefined });
    } catch {
      verification = { ok: false, checks: { recovery: { ok: false, code: 'publication-recheck-unavailable' } }, homepagePlacement: 'not-checked' };
    }
    await prisma.pipeline_runs.updateMany({
      where: { id: run.id, status: 'partial', errorStep: 'publication-verification' },
      data: { status: verification.ok ? 'success' : 'partial',
        errorStep: verification.ok ? null : 'publication-verification',
        errorMessage: verification.ok ? null : 'Artikel gespeichert; öffentliche Anzeige noch nicht bestätigt',
        completedAt: new Date(now),
        metadata: JSON.stringify({ ...metadata, publicationVerification: verification,
          publicationRecheckedAt: new Date(now).toISOString() }) },
    });
    if (verification.ok) result.recovered++;
  }
  return withPendingCount();
}
