import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { jwtVerify } from 'jose';
import { classifyContentAge } from '@/lib/time-axis-correction';
import { verifyBodyClaims } from '@/lib/streamer-claim-verifier';
import { getTVWatchProviders } from '@/lib/tmdb-watch-providers';
import { parseSourcePublishedAt } from '@/lib/source-published-at';
import { validateAndNormalizeArticleHtml } from '@/lib/article-html-safety';
import type { Prisma } from '@prisma/client';
import {
  decideEditorialPublication,
  type EditorialGateOutcome,
} from '@/lib/editorial-publication-gate';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function addConfiguredImageHost(target: Set<string>, configuredUrl: string | undefined): void {
  if (!configuredUrl) return;
  try {
    const parsed = new URL(configuredUrl);
    if (['http:', 'https:'].includes(parsed.protocol)
      && parsed.port === ''
      && !isPrivateHostname(parsed.hostname)) {
      target.add(parsed.hostname.toLowerCase().replace(/\.$/, ''));
    }
  } catch {
    // Invalid deployment configuration must not broaden the allowlist.
  }
}

function getAllowedImageHosts(): { allowed: Set<string>; site: Set<string> } {
  const siteHosts = new Set([
    'serien.de',
    'www.serien.de',
  ]);
  const externalHosts = new Set(['image.tmdb.org']);

  for (const configuredUrl of [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    addConfiguredImageHost(siteHosts, configuredUrl);
  }

  for (const configuredUrl of [
    process.env.R2_PUBLIC_URL,
    process.env.NEXT_PUBLIC_R2_URL,
    process.env.BLOB_PUBLIC_URL,
    process.env.NEXT_PUBLIC_BLOB_URL,
  ]) {
    addConfiguredImageHost(externalHosts, configuredUrl);
  }

  return {
    allowed: new Set([...siteHosts, ...externalHosts]),
    site: siteHosts,
  };
}

function isAllowedLocalImagePath(url: URL): boolean {
  return [
    '/img/',
    '/images/',
    '/branding/',
    '/placeholders/',
    '/series-backdrops/',
    '/hero-samples/',
    '/og-samples/',
  ].some((prefix) => url.pathname.startsWith(prefix));
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

async function verifyReachableImage(rawUrl: string | null): Promise<{ ok: boolean; reason: string }> {
  if (!rawUrl?.trim()) return { ok: false, reason: 'Kein Hero-Bild gesetzt' };

  const siteBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://serien.de';
  let current: URL;
  try {
    current = new URL(rawUrl, siteBase);
  } catch {
    return { ok: false, reason: 'Hero-Bild-URL ist ungültig' };
  }

  const { allowed: allowedHosts, site: siteHosts } = getAllowedImageHosts();
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const hostname = current.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(current.protocol)
      || current.port !== ''
      || isPrivateHostname(hostname)
      || !allowedHosts.has(hostname)) {
      return { ok: false, reason: 'Hero-Bild-Host ist nicht für serverseitige Prüfungen freigegeben' };
    }
    if (hostname === 'image.tmdb.org' && current.protocol !== 'https:') {
      return { ok: false, reason: 'TMDB-Bilder müssen über HTTPS geladen werden' };
    }
    if (siteHosts.has(hostname) && !isAllowedLocalImagePath(current)) {
      return { ok: false, reason: 'Lokaler Hero-Bildpfad ist nicht freigegeben' };
    }

    try {
      const response = await fetch(current, {
        method: 'GET',
        headers: { Range: 'bytes=0-1023' },
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirectCount === 3) {
          return { ok: false, reason: 'Hero-Bild-Weiterleitung ist ungültig' };
        }
        current = new URL(location, current);
        continue;
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      const ok = response.ok && contentType.startsWith('image/');
      await response.body?.cancel();
      return ok
        ? { ok: true, reason: 'Hero-Bild erreichbar' }
        : { ok: false, reason: `Hero-Bild nicht erreichbar oder kein Bild (HTTP ${response.status})` };
    } catch {
      return { ok: false, reason: 'Hero-Bild-Prüfung ist wegen eines Netzwerkfehlers fehlgeschlagen' };
    }
  }

  return { ok: false, reason: 'Hero-Bild konnte nicht geprüft werden' };
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
        select: { status: true, errorMessage: true },
      });

      return NextResponse.json({
        article: {
          ...article,
          authorName: article.users?.name || 'Unbekannt',
          seriesName: article.series?.name || article.series?.title || null,
          reviewReason: lastPipelineRun?.errorMessage || null,
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
    if (!id || !['save-draft', 'review-and-publish'].includes(action)) {
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
      gate: 'source-review',
      status: editorialReviewConfirmed ? 'pass' : 'fail',
      reason: editorialReviewConfirmed
        ? isTimelessEditorial
          ? 'Zeitlose Klassifizierung und Inhalt redaktionell bestätigt'
          : 'Quelle und Quellzeitpunkt redaktionell bestätigt'
        : isTimelessEditorial
          ? 'Explizite redaktionelle Bestätigung der zeitlosen Klassifizierung fehlt'
          : 'Explizite redaktionelle Bestätigung von Quelle und Quellzeitpunkt fehlt',
    });

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
    } else if (!sourcePublishedAt) {
      gateOutcomes.push({ gate: 'freshness', status: 'fail', reason: 'Belastbarer Quellzeitpunkt fehlt' });
    } else {
      try {
        const age = classifyContentAge({
          sourcePublishedAt,
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

    try {
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
    const imageResult = await verifyReachableImage(effectiveImageUrl);
    gateOutcomes.push({
      gate: 'hero-image',
      status: imageResult.ok ? 'pass' : 'fail',
      reason: imageResult.reason,
    });
    gateOutcomes.push({ gate: 'release-mode', status: 'pass', reason: 'Explizite Admin-Freigabe' });

    const decision = decideEditorialPublication({
      alreadyDraft: false,
      outcomes: gateOutcomes,
      requiredGates: [
        'quality',
        'text-safety',
        'html-safety',
        'anti-ai',
        'fact-safety',
        'source-review',
        'source',
        'freshness',
        'body-facts',
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
          id: `admin-review-${randomUUID()}`,
          pipeline: 'admin-review',
          trigger: 'manual',
          status: 'success',
          inputSource: 'editorial-review',
          articleId: id,
          articleSlug: article.slug,
          articleTitle: title,
          completedAt: publishedAt,
          metadata: JSON.stringify({
            reviewedBy: adminUserId,
            reviewedAt: publishedAt.toISOString(),
            editorialReviewConfirmed: true,
            sourceConfirmed: !isTimelessEditorial,
            ...(isTimelessEditorial
              ? { sourceNotApplicableReason: 'timeless-feature-or-ranking' }
              : {}),
          }),
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

    // Public caches are invalidated only after the durable publication write.
    // A cache API failure must not turn a successful DB publication into a
    // misleading 500 response that invites a duplicate retry.
    let cacheRevalidated = true;
    try {
      revalidatePath(`/${published.slug}`, 'page');
      revalidatePath('/', 'page');
      revalidatePath('/news', 'page');
      revalidatePath('/news-sitemap.xml');
      revalidatePath('/sitemap.xml');
    } catch (error) {
      cacheRevalidated = false;
      console.error('Article published, cache revalidation failed:', errorMessage(error));
    }

    return NextResponse.json({
      success: true,
      published: true,
      status: 'published',
      article: published,
      gates: gateOutcomes,
      cacheRevalidated,
      warning: cacheRevalidated
        ? undefined
        : 'Artikel ist veröffentlicht, aber die Cache-Aktualisierung ist fehlgeschlagen. Bitte Live-Seite prüfen.',
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
