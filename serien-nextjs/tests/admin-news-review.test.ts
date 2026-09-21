import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewManualNews } from '../lib/admin-news-review';
import { editorialBodyParagraphs, editorialPayloadHash, reviewAndRepairArticle, type EditorialReview } from '../lib/editorial-review';
import { fetchEditorialSource, publicSourceAddress } from '../lib/editorial-source-fetch';

const now = new Date();
const sourceUrl = 'https://studio.example/news/nordhafen';
const paragraph = 'Die Dreharbeiten zur zweiten Staffel von Nordhafen beginnen. Gedreht wird erneut im Hafenviertel, das bereits in den bisherigen Folgen im Mittelpunkt stand. Die beiden Hauptdarsteller übernehmen wieder ihre Rollen, wie das Produktionsteam in seiner Mitteilung bekannt gab. Zum genauen Veröffentlichungstermin, weiteren Drehorten und möglichen neuen Figuren macht die Mitteilung noch keine Angaben.';
const article = {
  headline: 'Nordhafen: Die Dreharbeiten zur zweiten Staffel beginnen',
  excerpt: 'Die Produktion von Nordhafen hat den Beginn der Dreharbeiten bestätigt.',
  metaDescription: 'Die zweite Staffel von Nordhafen geht in die Produktion. Die beiden Hauptdarsteller kehren zurück, ein Veröffentlichungstermin steht noch nicht fest.',
  contentHtml: `<p>${paragraph}</p><p>${paragraph.replace('Die Dreharbeiten', 'Die Arbeiten')}</p><p>${paragraph.replace('Die Dreharbeiten', 'Die Produktion')}</p>`,
};
const sourceQuote = 'Filming on the second season of Nordhafen begins.';
const source = { title: 'Nordhafen returns', publishDate: now,
  fullText: `${sourceQuote} Both actors return to their roles. No release date has been announced. `.repeat(8),
};
const input = { article, sourceUrl, sourcePublishedAt: now, sourceConfirmed: true, seriesName: 'Nordhafen' };

async function run() {
  let reviews = 0;
  const review: typeof reviewAndRepairArticle = (candidate, evidence, options) => {
    assert.equal(options?.maxRevisions, 0, 'manual prose must never be silently rewritten');
    assert.equal(evidence.sourceText, source.fullText);
    assert.equal(evidence.sourceTitle, source.title);
    assert.equal(candidate.excerpt, article.excerpt);
    assert.equal(candidate.metaDescription, article.metaDescription);
    assert(candidate.contentHtml.includes(sourceUrl), 'source attribution is added before review');
    reviews++;
    return reviewAndRepairArticle(candidate, evidence, { maxRevisions: 0, callJson: async () => ({
      complete: true, newsworthy: true, verdict: 'publish', clarity: 4, originality: 4,
      coverage: { headline: true, excerpt: true, metaDescription: true, bodyParagraphIndexes: editorialBodyParagraphs(candidate).map(p => p.index) },
      issues: [], claims: [{ articleQuote: 'Die Dreharbeiten zur zweiten Staffel von Nordhafen beginnen.', sourceQuote, source: 'original', assessment: 'supported' }],
    } satisfies EditorialReview) });
  };
  const previousFlag = process.env.AUTOMATED_NEWS_PUBLISHING_ENABLED;
  try {
    for (const flag of ['false', 'true', '']) {
      process.env.AUTOMATED_NEWS_PUBLISHING_ENABLED = flag;
      const result = await reviewManualNews(input, { fetchSource: async () => source, review, now });
      assert(result.decision.passed, `explicit manual release is independent of the automatic flag: ${result.decision.reasons.join('; ')}`);
      assert.equal(result.audit.reviewedPayloadHash, editorialPayloadHash(result.article));
      assert.equal(result.audit.sourceDateProvenance, 'publisher-metadata');
      assert.equal(result.audit.trust, 'explicit-human-release-with-full-source-review');
    }
  } finally {
    if (previousFlag === undefined) delete process.env.AUTOMATED_NEWS_PUBLISHING_ENABLED;
    else process.env.AUTOMATED_NEWS_PUBLISHING_ENABLED = previousFlag;
  }
  assert.equal(reviews, 3);
  const noNetwork = async () => { throw new Error('must not fetch'); };
  await assert.rejects(reviewManualNews({ ...input, sourceConfirmed: false }, { fetchSource: noNetwork }), /Bestätigung/);
  await assert.rejects(reviewManualNews({ ...input, sourceUrl: 'http://127.0.0.1/' }, { fetchSource: noNetwork }), /Originalquelle/);
  for (const field of ['headline', 'excerpt', 'metaDescription', 'contentHtml'] as const) {
    await assert.rejects(reviewManualNews({ ...input, article: { ...article, [field]: '' } }, { fetchSource: noNetwork }), /Vollständiges Paket/);
  }
  await assert.rejects(reviewManualNews(input, { fetchSource: async () => { throw new Error('source unavailable'); } }), /source unavailable/);
  await assert.rejects(reviewManualNews(input, {
    fetchSource: async () => ({ ...source, fullText: '' }),
    review: (payload, evidence) => reviewAndRepairArticle(payload, evidence, { callJson: async () => { throw new Error('must not call'); } }),
  }), /Originalvolltext/);
  await assert.rejects(reviewManualNews({ ...input, sourcePublishedAt: null }, { fetchSource: async () => ({ ...source, publishDate: undefined }), review }), /Quellzeitpunkt/);
  const attested = await reviewManualNews(input, { fetchSource: async () => ({ ...source, publishDate: undefined }), review, now });
  assert.equal(attested.audit.sourceDateProvenance, 'explicit-editor-attestation');
  await assert.rejects(reviewManualNews(input, {
    fetchSource: async () => ({ ...source, publishDate: new Date(now.getTime() - 40 * 86_400_000) }), review, now,
  }), /nicht für eine aktuelle Meldung/, 'an editor timestamp must not override stale publisher metadata');
  await assert.rejects(reviewManualNews(input, {
    fetchSource: async () => ({ ...source, publishDate: new Date(now.getTime() + 2 * 86_400_000) }),
    review: (payload, evidence) => reviewAndRepairArticle(payload, evidence, { callJson: async () => { throw new Error('must not call'); } }), now,
  }), /Zukunft/);
  for (const field of ['excerpt', 'metaDescription'] as const) {
    const lateClaim = 'In Deutschland startet die Staffel am 1. Oktober.';
    const candidate = { ...article, [field]: `${article[field]} ${lateClaim}` };
    const result = await reviewManualNews({ ...input, article: candidate }, {
      fetchSource: async () => source,
      review: (payload, evidence, options) => {
        assert(payload[field].includes(lateClaim), 'late metadata facts must reach source review');
        return reviewAndRepairArticle(payload, evidence, { ...options, callJson: async () => ({
          complete: true, newsworthy: true, verdict: 'publish', clarity: 5, originality: 5,
          coverage: { headline: true, excerpt: true, metaDescription: true, bodyParagraphIndexes: editorialBodyParagraphs(payload).map(p => p.index) },
          issues: [], claims: [{ articleQuote: lateClaim, sourceQuote, source: 'original', assessment: 'unsupported' }],
        }) });
      },
    });
    assert.equal(result.decision.passed, false, `one unsupported ${field} claim blocks publication`);
  }
  for (const addresses of [[], ['127.0.0.1'], ['10.0.0.3'], ['169.254.169.254'], ['100.64.0.1'], ['8.8.8.8', '192.168.1.2'], ['::1']]) {
    assert.throws(() => publicSourceAddress(addresses));
  }
  assert.equal(publicSourceAddress(['8.8.8.8']), '8.8.8.8');
  await assert.rejects(fetchEditorialSource('http://localhost/', { requestHtml: noNetwork }), /not-public/);
  const extracted = await fetchEditorialSource(sourceUrl, { requestHtml: async () => `<html><head><meta property="article:published_time" content="${now.toISOString()}"></head><body><h1>${source.title}</h1><nav>Navigation claim</nav><article><p>${source.fullText}</p></article></body></html>` });
  assert.equal(extracted.fullText, source.fullText.trim());
  assert.equal(extracted.publishDate?.toISOString(), now.toISOString());
  await assert.rejects(fetchEditorialSource(sourceUrl, { requestHtml: async () => '<h1>No article</h1><p>Only a login page.</p>' }), /body-missing/);
  const route = readFileSync(new URL('../app/api/admin/articles/route.ts', import.meta.url), 'utf8');
  assert(route.includes("action === 'verify-publication'"));
  assert(route.includes("status: 'partial'"));
  assert(route.includes('editorialPayloadHash('));
  assert(!route.includes('AUTOMATED_NEWS_PUBLISHING_ENABLED'));
  console.log('admin-news-review tests passed (offline, mocked evidence/reviewer)');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
