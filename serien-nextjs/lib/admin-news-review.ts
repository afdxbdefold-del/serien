import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { reviewAndRepairArticle, type EditorialArticle, type GermanyCatalogEvidence } from './editorial-review';
import { fetchEditorialSource } from './editorial-source-fetch';
import { isSafePublicHttpUrl, validateAndNormalizeArticleHtml } from './article-html-safety';
import { classifyContentAge } from './time-axis-correction';

interface ManualNewsInput {
  article: EditorialArticle;
  sourceUrl: string;
  sourcePublishedAt: Date | null;
  sourceConfirmed: boolean;
  seriesName: string;
  /** Server-observed DE catalog only; never accept this from an editor's body. */
  germanyCatalog?: GermanyCatalogEvidence;
}

/** Explicit human publication, not an automatic release-mode escape hatch.
 * Check the full human-edited package without silently rewriting its prose.
 */
export async function reviewManualNews(input: ManualNewsInput, deps: {
  fetchSource?: typeof fetchEditorialSource;
  review?: typeof reviewAndRepairArticle;
  now?: Date;
} = {}) {
  if (!input.sourceConfirmed || !isSafePublicHttpUrl(input.sourceUrl)) {
    throw new Error('Explizite Bestätigung einer öffentlichen Originalquelle fehlt');
  }
  if (Object.values(input.article).some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Vollständiges Paket aus Titel, Vorspann, Meta-Beschreibung und Inhalt erforderlich');
  }
  const source = await (deps.fetchSource || fetchEditorialSource)(input.sourceUrl);
  const sourcePublishedAt = source.publishDate || input.sourcePublishedAt;
  if (!sourcePublishedAt || !Number.isFinite(sourcePublishedAt.getTime())) {
    throw new Error('Belastbarer Quellzeitpunkt fehlt');
  }
  const age = classifyContentAge({ sourcePublishedAt, headline: input.article.headline, contentType: 'NEWS' });
  if (age.publishDecision !== 'PUBLISH' || !age.allowedContentTypes.includes('NEWS')) {
    throw new Error('Originalquelle ist nicht für eine aktuelle Meldung freigegeben');
  }
  const $ = load(input.article.contentHtml, null, false);
  const alreadyLinked = $('a[href]').toArray().some(element => {
    if ($(element).parents('.related-articles').length || !$(element).text().trim()) return false;
    try { return new URL($(element).attr('href')!).href === new URL(input.sourceUrl).href; }
    catch { return false; }
  });
  if (!alreadyLinked) {
    const anchor = $('<a></a>').attr('href', input.sourceUrl).attr('rel', 'noopener noreferrer').text(source.title);
    const credit = $('<p></p>').text('Quelle: ').append(anchor);
    $.root().append(credit);
  }
  const html = validateAndNormalizeArticleHtml($.html());
  if (!html.ok || !html.normalizedHtml) throw new Error('Quellenvermerk konnte nicht sicher ergänzt werden');
  const article = { ...input.article, contentHtml: html.normalizedHtml };
  const review = await (deps.review || reviewAndRepairArticle)(article, {
    sourceUrl: input.sourceUrl, sourceTitle: source.title, sourceText: source.fullText,
    sourcePublishedAt: sourcePublishedAt.toISOString(), seriesName: input.seriesName, now: deps.now,
    germanyCatalog: input.germanyCatalog,
  }, { maxRevisions: 0 });
  return {
    article, decision: review.decision, sourcePublishedAt,
    audit: {
      trust: 'explicit-human-release-with-full-source-review',
      sourceDateProvenance: source.publishDate ? 'publisher-metadata' : 'explicit-editor-attestation',
      sourceEvidenceHash: createHash('sha256').update(`${source.title}\n${source.fullText}`).digest('hex'),
      reviewedPayloadHash: review.decision.payloadHash,
      sourcePublishedAt: sourcePublishedAt.toISOString(),
      sourceReview: review.decision.review,
    },
  };
}
