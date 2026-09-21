import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { jwtVerify } from 'jose';
import { classifyContentAge } from '@/lib/time-axis-correction';
import { verifyBodyClaims } from '@/lib/streamer-claim-verifier';
import { getTVWatchProviders } from '@/lib/tmdb-watch-providers';
import { parseSourcePublishedAt } from '@/lib/source-published-at';
import { validateAndNormalizeArticleHtml } from '@/lib/article-html-safety';
import type { Prisma } from '@prisma/client';
import { reviewManualNews } from '@/lib/admin-news-review';
import { editorialPayloadHash } from '@/lib/editorial-review';
import { fetchNewsArticles } from '@/app/news/_data';
import { PAGE_SIZE as NEWS_PAGE_SIZE } from '@/app/news/_lib';
import {
  revalidatePublicationCaches, verifyEditorialImage, verifyPublishedArticle,
  type PublishedArticleVerification,
} from '@/lib/publication-verification';
import {
  decideEditorialPublication,
  type EditorialGateOutcome,
} from '@/lib/editorial-publication-gate';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function editorialImageOrigins(): string[] {
  return [process.env.R2_PUBLIC_URL, process.env.NEXT_PUBLIC_R2_URL].filter(Boolean) as string[];
}

/** The article is already committed. Never signal a failed write or retry it. */
async function checkCommittedPublication(
  article: { id: string; slug: string; title: string; heroImageUrl: string | null },
  runId: string, metadata: Record<string, unknown>,
) {
  let invalidation = await revalidatePublicationCaches(article.slug);
  if (!invalidation.ok) invalidation = await revalidatePublicationCaches(article.slug, {
    invalidate(paths, tags) {
      for (const tag of tags) revalidateTag(tag);
      for (const path of paths) revalidatePath(path);
    },
  });
  let verification: PublishedArticleVerification;
  try {
    const [latest, currentNewsPage] = await Promise.all([
      prisma.articles.findMany({ where: { status: { in: ['published', 'PUBLISHED'] } },
        orderBy: { publishedAt: 'desc' }, take: 40, select: { id: true, primarySeriesId: true } }),
      fetchNewsArticles({ limit: NEWS_PAGE_SIZE }),
    ]);
    // Match the actual per-series homepage selection. Older/superseded stories
    // must not remain "pending" merely because newer articles took their slot.
    const homepageIds: string[] = [];
    const seenSeries = new Set<number>();
    for (const candidate of latest) {
      if (candidate.primarySeriesId != null) {
        if (seenSeries.has(candidate.primarySeriesId)) continue;
        seenSeries.add(candidate.primarySeriesId);
      }
      homepageIds.push(candidate.id);
      if (homepageIds.length === 11) break;
    }
    const position = homepageIds.indexOf(article.id);
    verification = await verifyPublishedArticle({
      slug: article.slug, title: article.title, heroImageUrl: article.heroImageUrl || '',
      expectedOnHomepage: position >= 0,
      expectedCarousel: position >= 0 && position < 5 ? 'present' : undefined,
      expectedInNews: currentNewsPage.some(candidate => candidate.id === article.id),
    }, { imageOrigins: editorialImageOrigins() });
  } catch {
    verification = { ok: false, checks: { publication: { ok: false, code: 'verification-unavailable' } }, homepagePlacement: 'not-checked' };
  }
  let verificationAuditSaved = true;
  try {
    await prisma.pipeline_runs.update({
      where: { id: runId },
      data: {
        status: verification.ok ? 'success' : 'partial',
        errorStep: verification.ok ? null : 'publication-verification',
        errorMessage: verification.ok ? null : 'Artikel gespeichert; öffentliche Anzeige noch nicht vollständig bestätigt',
        completedAt: new Date(),
        metadata: JSON.stringify({ ...metadata, cacheInvalidation: invalidation,
          publicationVerification: verification, publicationRecheckedAt: new Date().toISOString() }),
      },
    });
  } catch {
    verificationAuditSaved = false;
    console.error('Manual publication verification audit could not be updated');
  }
  return {
    publicationVerified: verification.ok,
    publicationVerification: verification,
    cacheRevalidated: invalidation.ok && invalidation.code !== 'cache-invalidation-queued',
    cacheInvalidation: invalidation,
    verificationAuditSaved,
    warning: !verification.ok
      ? 'Artikel ist gespeichert und freigegeben; die öffentliche Anzeige ist noch nicht vollständig bestätigt. Nicht erneut veröffentlichen, sondern die Live-Anzeige nachprüfen.'
      : !verificationAuditSaved ? 'Öffentliche Anzeige bestätigt; Prüfprotokoll konnte nicht aktualisiert werden.' : undefined,
  };
}

async function getVerifiedAdminId(request: NextRequest): Promise<string | null> {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) return null;
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : request.cookies.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), {
      algorithms: ['HS256'],
    });
    return payload.role === 'admin' && typeof payload.userId === 'string'
      ? payload.userId
      : null;
  } catch {
    return null;
  }
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.endsWith('.local')) return true;
  if (host.includes(':')) return true;

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  return octets.some((part) => part < 0 || part > 255)
    || octets[0] === 0
    || octets[0] === 10
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 0 && [0, 2].includes(octets[2]))
    || (octets[0] === 198 && [18, 19, 51].includes(octets[1]))
    || (octets[0] === 203 && octets[1] === 0 && octets[2] === 113)
    || octets[0] >= 224;
}


function validateSourceUrl(rawUrl: string | null): { ok: boolean; reason: string } {
  if (!rawUrl?.trim()) return { ok: false, reason: 'Keine Quell-URL gesetzt' };
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)
      || parsed.port !== ''
      || parsed.username !== ''
      || parsed.password !== ''
      || isPrivateHostname(parsed.hostname)) {
      return { ok: false, reason: 'Quell-URL muss eine öffentliche HTTP(S)-Adresse sein' };
    }
    return { ok: true, reason: 'Quell-URL vorhanden' };
  } catch {
    return { ok: false, reason: 'Quell-URL ist ungültig' };
  }
}

function validatePlainEditorialText(
  fields: Array<{ label: string; value: string | null }>,
): { ok: boolean; reason: string } {
  for (const field of fields) {
    if (!field.value) continue;
    if (/[<>]/.test(field.value)) {
      return { ok: false, reason: `${field.label} darf keine HTML-Zeichen enthalten` };
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(field.value)) {
      return { ok: false, reason: `${field.label} enthält unzulässige Steuerzeichen` };
    }
  }
  return { ok: true, reason: 'Textfeld-Sicherheitsprüfung bestanden' };
}


// GET - List articles with pagination and filtering
export async function GET(request: NextRequest) {
  if (!await verifyAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const contentType = searchParams.get('contentType') || '';
  const status = searchParams.get('status') || '';
  const id = searchParams.get('id');

  if (id) {
    try {
      const article = await prisma.articles.findUnique({
        where: { id },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          contentType: true,
          contentHtml: true,
          excerpt: true,
          metaDescription: true,
          heroImageUrl: true,
          heroLocalUrl: true,
          heroImagePath: true,
          sourceUrl: true,
          sourcePublishedAt: true,
          primarySeriesId: true,
          isRankingArticle: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          users: { select: { name: true } },
          series: { select: { name: true, title: true } },
        },
      });

      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      const lastPipelineRun = await prisma.pipeline_runs.findFirst({
        where: { articleId: id },
        orderBy: { startedAt: 'desc' },
        select: { status: true, errorMessage: true, pipeline: true },
      });

      return NextResponse.json({
        article: {
          ...article,
          authorName: article.users?.name || 'Unbekannt',
          seriesName: article.series?.name || article.series?.title || null,
          reviewReason: lastPipelineRun?.errorMessage || null,
          canVerifyPublication: lastPipelineRun?.pipeline === 'admin-review',
        },
      });
    } catch (error) {
      console.error('Error fetching article:', error);
      return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
    }
  }

  const where: Prisma.articlesWhereInput = {};
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (contentType) {
    where.contentType = contentType;
  }
  
  if (status) {
    where.status = status;
  }

  try {
    const [articles, total] = await Promise.all([
      prisma.articles.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          contentType: true,
          publishedAt: true,
          createdAt: true,
          users: {
            select: { name: true }
          },
          series: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: page * limit,
        take: limit,
      }),
      prisma.articles.count({ where }),
    ]);

    return NextResponse.json({
      articles: articles.map(a => ({
        ...a,
        authorName: a.users?.name || 'Unbekannt',
        seriesName: a.series?.name || null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

// PATCH - Save a review draft or publish it after all final gates pass again.
export async function PATCH(request: NextRequest) {
  const adminUserId = await getVerifiedAdminId(request);
  if (!adminUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action;
    if (!id || !['save-draft', 'review-and-publish', 'verify-publication'].includes(action)) {
      return NextResponse.json({ error: 'Article ID and valid action required' }, { status: 400 });
    }

    const article = await prisma.articles.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        contentHtml: true,
        excerpt: true,
        metaDescription: true,
        heroImageUrl: true,
        heroLocalUrl: true,
        heroImagePath: true,
        sourceUrl: true,
        sourcePublishedAt: true,
        primarySeriesId: true,
        contentType: true,
        isRankingArticle: true,
        updatedAt: true,
        series: {
          select: {
            name: true,
            title: true,
            status: true,
            lastAirDate: true,
            numberOfSeasons: true,
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    if (action === 'verify-publication') {
      if (!['published', 'PUBLISHED'].includes(article.status)) {
        return NextResponse.json({ error: 'Nur bereits veröffentlichte Artikel können nachgeprüft werden' }, { status: 409 });
      }
      const run = await prisma.pipeline_runs.findFirst({
        where: { pipeline: 'admin-review', articleId: article.id }, orderBy: { startedAt: 'desc' },
        select: { id: true, metadata: true },
      });
      if (!run) return NextResponse.json({ error: 'Kein manuelles Veröffentlichungsprotokoll vorhanden' }, { status: 409 });
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(run.metadata || '{}'); } catch { /* older malformed audit */ }
      const checked = await checkCommittedPublication({ ...article,
        heroImageUrl: article.heroImageUrl || article.heroLocalUrl || article.heroImagePath }, run.id, metadata);
      return NextResponse.json({ success: true, published: true, status: 'published', article: {
        id: article.id, slug: article.slug, title: article.title, status: article.status,
      }, ...checked });
    }
    if (article.status !== 'draft') {
      return NextResponse.json({ error: 'Nur Entwürfe können über diesen Review-Pfad geändert werden' }, { status: 409 });
    }

    const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string'
      ? new Date(body.expectedUpdatedAt)
      : null;
    if (!expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime())) {
      return NextResponse.json({ error: 'Versionsstand des Entwurfs fehlt' }, { status: 400 });
    }
    if (expectedUpdatedAt.getTime() !== article.updatedAt.getTime()) {
      return NextResponse.json({ error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : article.title;
    const requestedContentHtml = typeof body.contentHtml === 'string' ? body.contentHtml.trim() : article.contentHtml;
    const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : article.excerpt;
    const metaDescription = typeof body.metaDescription === 'string'
      ? body.metaDescription.trim()
      : article.metaDescription;
    const heroImageUrl = typeof body.heroImageUrl === 'string'
      ? body.heroImageUrl.trim() || null
      : article.heroImageUrl;
    const sourceUrl = typeof body.sourceUrl === 'string'
      ? body.sourceUrl.trim() || null
      : article.sourceUrl;
    const sourcePublishedAt = typeof body.sourcePublishedAt === 'string'
      ? parseSourcePublishedAt(body.sourcePublishedAt.trim() || null)
      : article.sourcePublishedAt;

    if (!title || !requestedContentHtml) {
      return NextResponse.json({ error: 'Titel und Artikelinhalt dürfen nicht leer sein' }, { status: 400 });
    }

    const textSafety = validatePlainEditorialText([
      { label: 'Titel', value: title },
      { label: 'Kurztext', value: excerpt },
      { label: 'Meta-Beschreibung', value: metaDescription },
    ]);
    if (!textSafety.ok) {
      return NextResponse.json({
        success: false,
        published: false,
        status: 'draft',
        error: `Textfeld-Sicherheitsprüfung fehlgeschlagen: ${textSafety.reason}`,
        gates: [{ gate: 'text-safety', status: 'fail', reason: textSafety.reason }],
      }, { status: 422 });
    }

    const htmlSafety = validateAndNormalizeArticleHtml(requestedContentHtml);
    if (!htmlSafety.ok || !htmlSafety.normalizedHtml) {
      return NextResponse.json({
        success: false,
        published: false,
        status: 'draft',
        error: `HTML-Sicherheitsprüfung fehlgeschlagen: ${htmlSafety.reason}`,
        gates: [{ gate: 'html-safety', status: 'fail', reason: htmlSafety.reason }],
      }, { status: 422 });
    }
    const contentHtml = htmlSafety.normalizedHtml;

    const sourceValidation = validateSourceUrl(sourceUrl);
    if (sourceUrl && !sourceValidation.ok) {
      return NextResponse.json({ error: sourceValidation.reason }, { status: 400 });
    }

    const nextUpdatedAt = new Date(Math.max(Date.now(), article.updatedAt.getTime() + 1));
    const draftData = {
      title,
      contentHtml,
      excerpt: excerpt || null,
      metaDescription: metaDescription || null,
      heroImageUrl,
      sourceUrl,
      sourcePublishedAt,
      updatedAt: nextUpdatedAt,
    };

    if (action === 'save-draft') {
      const saved = await prisma.articles.updateMany({
        where: { id, status: 'draft', updatedAt: expectedUpdatedAt },
        data: draftData,
      });
      if (saved.count !== 1) {
        return NextResponse.json({ error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        published: false,
        status: 'draft',
        article: { id, slug: article.slug, status: 'draft', updatedAt: nextUpdatedAt },
      });
    }

    const seriesName = article.series?.name || article.series?.title || '';
    const gateOutcomes: EditorialGateOutcome[] = [];
    const normalizedContentType = (article.contentType || '').trim().toUpperCase();
    const isTimelessEditorial = article.isRankingArticle
      || ['RANKING', 'RANKING_LIST', 'FEATURE', 'FEATURE_ESSAY'].includes(normalizedContentType);
    const editorialReviewConfirmed = isTimelessEditorial
      ? body.editorialReviewConfirmed === true
      : body.sourceConfirmed === true;
    gateOutcomes.push({ gate: 'text-safety', status: 'pass', reason: textSafety.reason });
    gateOutcomes.push({ gate: 'html-safety', status: 'pass', reason: htmlSafety.reason });
    gateOutcomes.push({
      gate: 'editor-confirmation',
      status: editorialReviewConfirmed ? 'pass' : 'fail',
      reason: editorialReviewConfirmed
        ? isTimelessEditorial
          ? 'Zeitlose Klassifizierung und Inhalt redaktionell bestätigt'
          : 'Quelle und Quellzeitpunkt redaktionell bestätigt'
        : isTimelessEditorial
          ? 'Explizite redaktionelle Bestätigung der zeitlosen Klassifizierung fehlt'
          : 'Explizite redaktionelle Bestätigung von Quelle und Quellzeitpunkt fehlt',
    });

    let sourceReviewAudit: Record<string, unknown> | null = null;
    if (!isTimelessEditorial) {
      try {
        const reviewed = await reviewManualNews({
          article: { headline: title, excerpt: excerpt || '', metaDescription: metaDescription || '', contentHtml },
          sourceUrl: sourceUrl || '', sourcePublishedAt, sourceConfirmed: editorialReviewConfirmed, seriesName,
        });
        draftData.contentHtml = reviewed.article.contentHtml;
        draftData.sourcePublishedAt = reviewed.sourcePublishedAt;
        sourceReviewAudit = reviewed.audit;
        gateOutcomes.push({ gate: 'source-review', status: reviewed.decision.passed ? 'pass' : 'fail',
          reason: reviewed.decision.reasons.join('; ') || 'Vollständiges Veröffentlichungspaket gegen die Originalquelle geprüft' });
      } catch {
        gateOutcomes.push({ gate: 'source-review', status: 'error',
          reason: 'Vollständige Originalquelle, belastbarer Quellzeitpunkt oder vollständiger Quellenreview nicht verfügbar. Entwurf bleibt gespeichert.' });
      }
    }

    // Timeless manually classified features retain their existing review path.
    // For NEWS, the complete source review replaces legacy TMDB-only and
    // generic anti-AI checks that falsely reject new international announcements.
    if (isTimelessEditorial) {
      try {
        const { qualityCheck } = await import('@/lib/quality-checker');
        const result = await qualityCheck({
          generatedArticleHtml: contentHtml,
          finalHeadline: title,
          primarySeriesName: seriesName,
          extractedFacts: '',
          isRankingList: article.isRankingArticle,
        });
        gateOutcomes.push({
          gate: 'quality',
          status: result.status === 'PASS' ? 'pass' : 'fail',
          reason: result.failReasons.join('; ') || result.status,
        });
      } catch (error) {
        gateOutcomes.push({ gate: 'quality', status: 'error', reason: errorMessage(error) });
      }

      try {
        const { antiAiFilter } = await import('@/lib/anti-ai-filter');
        const result = await antiAiFilter({
          articleHtml: contentHtml,
          headline: title,
          seriesName,
          isRankingList: article.isRankingArticle,
        });
        gateOutcomes.push({
          gate: 'anti-ai',
          status: result.status === 'PASS' ? 'pass' : 'fail',
          reason: result.failReasons.join('; ') || result.status,
        });
      } catch (error) {
        gateOutcomes.push({ gate: 'anti-ai', status: 'error', reason: errorMessage(error) });
      }

      try {
        const { factSafetyCheck } = await import('@/lib/fact-safety-layer');
        const result = await factSafetyCheck({
          articleHtml: contentHtml,
          headline: title,
          extractedFacts: '',
          tmdbSeriesData: {
            status: article.series?.status || undefined,
            lastAirDate: article.series?.lastAirDate?.toISOString(),
            numberOfSeasons: article.series?.numberOfSeasons || undefined,
          },
        });
        gateOutcomes.push({
          gate: 'fact-safety',
          status: result.status === 'SAFE' ? 'pass' : 'fail',
          reason: result.headlineViolations.join('; ')
            || result.rejectedFacts.map((fact) => fact.claim).join('; ')
            || result.status,
        });
      } catch (error) {
        gateOutcomes.push({ gate: 'fact-safety', status: 'error', reason: errorMessage(error) });
      }
    }

    const sourceResult = sourceValidation;
    gateOutcomes.push({
      gate: 'source',
      status: isTimelessEditorial || sourceResult.ok ? 'pass' : 'fail',
      reason: isTimelessEditorial && !sourceResult.ok
        ? 'Explizit als zeitloser Feature-/Ranking-Inhalt klassifiziert'
        : sourceResult.reason,
    });

    if (isTimelessEditorial) {
      gateOutcomes.push({
        gate: 'freshness',
        status: 'pass',
        reason: 'Explizit als zeitloser Feature-/Ranking-Inhalt klassifiziert',
      });
    } else if (!draftData.sourcePublishedAt) {
      gateOutcomes.push({ gate: 'freshness', status: 'fail', reason: 'Belastbarer Quellzeitpunkt fehlt' });
    } else {
      try {
        const age = classifyContentAge({
          sourcePublishedAt: draftData.sourcePublishedAt,
          headline: title,
          contentType: 'NEWS',
        });
        const freshNewsAllowed = age.publishDecision === 'PUBLISH'
          && age.allowedContentTypes.includes('NEWS');
        gateOutcomes.push({
          gate: 'freshness',
          status: freshNewsAllowed ? 'pass' : 'fail',
          reason: age.reasons.join('; ') || age.contentAgeClass,
        });
      } catch (error) {
        gateOutcomes.push({ gate: 'freshness', status: 'error', reason: errorMessage(error) });
      }
    }

    if (isTimelessEditorial) try {
      const providers = article.primarySeriesId
        ? await getTVWatchProviders(article.primarySeriesId)
        : null;
      const providerNames = [
        ...(providers?.flatrate || []),
        ...(providers?.free || []),
        ...(providers?.ads || []),
      ].map((provider) => provider.provider_name);
      const result = verifyBodyClaims(contentHtml, [...new Set(providerNames)]);
      gateOutcomes.push({
        gate: 'body-facts',
        status: result.ok ? 'pass' : 'fail',
        reason: result.negativeDeClaimMismatch
          ? 'Widersprüchliche DACH-Verfügbarkeitsaussage'
          : result.unverifiedClaims.length > 0
            ? `${result.unverifiedClaims.length} unbelegte Streamer-Aussage(n)`
            : `${result.verifiedClaims}/${result.totalClaims} Streamer-Aussagen verifiziert`,
      });
    } catch (error) {
      gateOutcomes.push({ gate: 'body-facts', status: 'error', reason: errorMessage(error) });
    }

    const effectiveImageUrl = heroImageUrl || article.heroLocalUrl || article.heroImagePath;
    const imageResult = await verifyEditorialImage(effectiveImageUrl || '', { imageOrigins: editorialImageOrigins() });
    // Persist the exact image checked; do not let the rendered article silently
    // fall back to a different TMDB/legacy URL after a successful image gate.
    draftData.heroImageUrl = effectiveImageUrl;
    gateOutcomes.push({
      gate: 'hero-image',
      status: imageResult.ok ? 'pass' : 'fail',
      reason: imageResult.code,
    });
    gateOutcomes.push({ gate: 'release-mode', status: 'pass', reason: 'Explizite Admin-Freigabe' });

    const decision = decideEditorialPublication({
      alreadyDraft: false,
      outcomes: gateOutcomes,
      requiredGates: [
        ...(isTimelessEditorial ? ['quality', 'anti-ai', 'fact-safety', 'body-facts'] : ['source-review']),
        'text-safety',
        'html-safety',
        'editor-confirmation',
        'source',
        'freshness',
        'hero-image',
        'release-mode',
      ],
    });

    if (decision.status === 'draft') {
      const saved = await prisma.articles.updateMany({
        where: { id, status: 'draft', updatedAt: expectedUpdatedAt },
        data: draftData,
      });
      if (saved.count !== 1) {
        return NextResponse.json({ error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        published: false,
        status: 'draft',
        reason: decision.reason,
        failedGates: decision.failedGates,
        gates: gateOutcomes,
        article: { id, slug: article.slug, status: 'draft', updatedAt: nextUpdatedAt },
      });
    }

    const publishedAt = new Date();
    const runId = `admin-review-${randomUUID()}`;
    const auditMetadata = {
      reviewedBy: adminUserId, reviewedAt: publishedAt.toISOString(),
      editorialReviewConfirmed: true, sourceConfirmed: !isTimelessEditorial,
      imageTrust: 'explicit-editor-selected-image-with-byte-check', imageVerification: imageResult,
      ...(sourceReviewAudit || { trust: 'explicit-human-timeless-editorial', sourceNotApplicableReason: 'timeless-feature-or-ranking' }),
    };
    if (!isTimelessEditorial && sourceReviewAudit?.reviewedPayloadHash !== editorialPayloadHash({
      headline: draftData.title, excerpt: draftData.excerpt || '', metaDescription: draftData.metaDescription || '', contentHtml: draftData.contentHtml,
    })) {
      return NextResponse.json({ error: 'Veröffentlichungspaket stimmt nicht mehr mit dem Quellenreview überein' }, { status: 409 });
    }
    const published = await prisma.$transaction(async (transaction) => {
      const publication = await transaction.articles.updateMany({
        where: { id, status: 'draft', updatedAt: expectedUpdatedAt },
        data: {
          ...draftData,
          status: 'published',
          publishedAt,
          publishMode: 'SEARCH_ONLY',
        },
      });
      if (publication.count !== 1) return null;

      await transaction.pipeline_runs.create({
        data: {
          id: runId,
          pipeline: 'admin-review',
          trigger: 'manual',
          status: 'partial',
          errorStep: 'publication-verification',
          errorMessage: 'Artikel gespeichert; öffentliche Anzeige noch nicht bestätigt',
          inputSource: 'editorial-review',
          articleId: id,
          articleSlug: article.slug,
          articleTitle: title,
          completedAt: publishedAt,
          metadata: JSON.stringify(auditMetadata),
        },
      });

      return transaction.articles.findUniqueOrThrow({
        where: { id },
        select: { id: true, slug: true, title: true, status: true, publishedAt: true },
      });
    });
    if (!published) {
      return NextResponse.json({ error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
    }

    const checked = await checkCommittedPublication({ ...published, heroImageUrl: effectiveImageUrl }, runId, auditMetadata);

    return NextResponse.json({
      success: true,
      published: true,
      status: 'published',
      article: published,
      gates: gateOutcomes,
      ...checked,
    });
  } catch (error) {
    console.error('Error reviewing article:', error);
    return NextResponse.json({ error: 'Article review failed' }, { status: 500 });
  }
}

// DELETE - Delete an article
export async function DELETE(request: NextRequest) {
  if (!await verifyAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Support both query param and body
  const { searchParams } = new URL(request.url);
  let id = searchParams.get('id');
  
  if (!id) {
    try {
      const body = await request.json();
      id = body.articleId || body.id;
    } catch {
      // No body
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'Article ID required' }, { status: 400 });
  }

  try {
    // Check if article exists
    const article = await prisma.articles.findUnique({
      where: { id },
      select: { title: true, slug: true }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Delete related data first (discover scores, qa, etc.)
    await prisma.discover_score_dashboards.deleteMany({
      where: { articleId: id }
    }).catch(() => {});
    
    await prisma.article_qa.deleteMany({
      where: { articleId: id }
    }).catch(() => {});

    // Delete the article
    await prisma.articles.delete({
      where: { id }
    });

    // Flush ISR + sitemap caches so the page goes 404 immediately.
    try {
      revalidatePath(`/${article.slug}`, 'page');
      revalidatePath('/', 'page');
      revalidatePath('/news', 'page');
      revalidatePath('/news-sitemap.xml');
      revalidatePath('/sitemap.xml');
    } catch { /* revalidate errors are not fatal */ }

    return NextResponse.json({ 
      success: true, 
      message: `Artikel "${article.title}" gelöscht`,
      slug: article.slug
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
