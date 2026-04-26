/**
 * WEB STORY GENERATOR
 *
 * Produces valid AMP HTML for Google Web Stories from an article record.
 * Stories appear in Google Discover's dedicated Web Stories carousel,
 * a separate surface from the regular feed → net-new traffic.
 *
 * Output: 5-page vertical story (9:16):
 *   1. COVER       — headline + hero image, "Serie: X" kicker
 *   2. WAS IST     — "was bedeutet das" 1-tap takeaway
 *   3. WARUM       — "darum relevant" context
 *   4. EINORDNUNG  — "bisheriger Stand"
 *   5. CTA         — link to full article with pulsing button
 *
 * Google Web Story requirements (honoured):
 *   - canonical → back to article (NOT the story itself)
 *   - publisher-logo-src (≥ 96×96)
 *   - poster-portrait-src (≥ 640×853, 3:4)
 *   - 4–30 pages, ≥5s each
 *   - No autoplay audio
 */

export interface WebStoryInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  heroImageUrl?: string | null;
  heroLocalUrl?: string | null;
  wasBedeutetDasText?: string | null;
  darumRelevantText?: string | null;
  bisherigerStandText?: string | null;
  seriesName?: string | null;
  category?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  authorName?: string | null;
}

const PUBLISHER = 'serien.de';
const PUBLISHER_LOGO = 'https://serien.de/brand/logo-square-1024.png';
const BASE_URL = 'https://serien.de';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip HTML tags, collapse whitespace, truncate. */
function sanitize(html: string | null | undefined, max = 220): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut) + '…';
}

function pickImageUrl(input: WebStoryInput): string {
  return (
    input.heroImageUrl ||
    (input.heroLocalUrl ? `${BASE_URL}${input.heroLocalUrl}` : '') ||
    `${BASE_URL}/og-default.jpg`
  );
}

interface Page {
  id: string;
  kicker?: string;
  headline: string;
  body?: string;
  image: string;
  theme: 'cover' | 'dark' | 'accent' | 'cta';
}

function buildPages(input: WebStoryInput): Page[] {
  const img = pickImageUrl(input);
  const kicker = input.seriesName || input.category || 'News';
  const pages: Page[] = [];

  // Page 1 — cover
  pages.push({
    id: 'cover',
    kicker: kicker.toUpperCase(),
    headline: input.title,
    image: img,
    theme: 'cover',
  });

  // Page 2 — was ist passiert (excerpt / wasBedeutetDas)
  const p2Body =
    sanitize(input.wasBedeutetDasText, 220) ||
    sanitize(input.excerpt, 220) ||
    sanitize(input.title, 220);
  if (p2Body) {
    pages.push({
      id: 'was',
      kicker: 'WAS IST PASSIERT',
      headline: 'Das Wichtigste',
      body: p2Body,
      image: img,
      theme: 'dark',
    });
  }

  // Page 3 — warum ist das relevant
  const p3Body = sanitize(input.darumRelevantText, 240);
  if (p3Body) {
    pages.push({
      id: 'warum',
      kicker: 'WARUM RELEVANT',
      headline: 'Darum zählt es',
      body: p3Body,
      image: img,
      theme: 'accent',
    });
  }

  // Page 4 — bisheriger Stand
  const p4Body = sanitize(input.bisherigerStandText, 240);
  if (p4Body) {
    pages.push({
      id: 'stand',
      kicker: 'BISHER BEKANNT',
      headline: 'Einordnung',
      body: p4Body,
      image: img,
      theme: 'dark',
    });
  }

  // Page 5 — CTA
  pages.push({
    id: 'cta',
    kicker: 'MEHR LESEN',
    headline: 'Ganzen Artikel lesen',
    body: 'Alle Details, Hintergründe und Reaktionen auf serien.de',
    image: img,
    theme: 'cta',
  });

  return pages;
}

function renderPage(p: Page, articleUrl: string): string {
  const isCover = p.theme === 'cover';
  const isCta = p.theme === 'cta';

  // Background: full-bleed image, with dark overlay for readability
  const bg = `
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(p.image)}" layout="fill" object-fit="cover" alt="${esc(p.headline)}"></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="fill" class="overlay ${p.theme}"></amp-story-grid-layer>`;

  const kicker = p.kicker
    ? `<div class="kicker">${esc(p.kicker)}</div>`
    : '';

  const body = p.body
    ? `<p class="body">${esc(p.body)}</p>`
    : '';

  const cta = isCta
    ? `
      <amp-story-cta-layer>
        <a href="${esc(articleUrl)}" class="cta-button">
          Artikel öffnen
        </a>
      </amp-story-cta-layer>`
    : '';

  const contentLayer = `
    <amp-story-grid-layer template="vertical" class="content ${p.theme}">
      ${kicker}
      <h1 class="${isCover ? 'cover-headline' : 'headline'}">${esc(p.headline)}</h1>
      ${body}
    </amp-story-grid-layer>`;

  return `
    <amp-story-page id="${esc(p.id)}" auto-advance-after="6s">
      ${bg}
      ${contentLayer}
      ${cta}
    </amp-story-page>`;
}

export function renderWebStory(input: WebStoryInput): string {
  const articleUrl = `${BASE_URL}/${input.slug}`;
  const storyUrl = `${BASE_URL}/web-stories/${input.slug}`;
  const poster = pickImageUrl(input);
  const pages = buildPages(input);
  const description = sanitize(input.excerpt || input.title, 180);
  const publishedIso = (input.publishedAt || input.updatedAt || new Date()).toISOString();
  const updatedIso = (input.updatedAt || input.publishedAt || new Date()).toISOString();

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.title,
    image: [poster],
    datePublished: publishedIso,
    dateModified: updatedIso,
    author: input.authorName ? { '@type': 'Person', name: input.authorName } : undefined,
    publisher: {
      '@type': 'NewsMediaOrganization',
      '@id': 'https://serien.de#organization',
      name: PUBLISHER,
      url: 'https://serien.de',
      logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO, width: 1200, height: 200 },
    },
    mainEntityOfPage: articleUrl,
    isPartOf: articleUrl,
    url: storyUrl,
  });

  return `<!doctype html>
<html ⚡ lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
  <title>${esc(input.title)} – ${PUBLISHER}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(articleUrl)}">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>
  <script type="application/ld+json">${jsonLd}</script>
  <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
  <style amp-custom>
    amp-story-page { background: #062344; }
    .overlay { background: linear-gradient(180deg, rgba(3,21,42,0.35) 0%, rgba(3,21,42,0.85) 100%); }
    .overlay.accent { background: linear-gradient(180deg, rgba(19,191,224,0.15) 0%, rgba(3,21,42,0.9) 100%); }
    .overlay.cta { background: linear-gradient(180deg, rgba(3,21,42,0.6) 0%, rgba(3,21,42,0.95) 100%); }
    .overlay.cover { background: linear-gradient(180deg, rgba(3,21,42,0.1) 0%, rgba(3,21,42,0.85) 70%, rgba(3,21,42,0.95) 100%); }
    .content { padding: 56px 40px 120px 40px; justify-content: flex-end; }
    .content.cover { padding-bottom: 140px; }
    .kicker {
      font: 800 14px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #13bfe0; letter-spacing: 2.5px; text-transform: uppercase;
      margin-bottom: 16px;
    }
    .cover-headline {
      font: 900 44px/1.05 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff; letter-spacing: -1px; margin: 0; text-shadow: 0 2px 20px rgba(0,0,0,0.4);
    }
    .headline {
      font: 900 34px/1.1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff; letter-spacing: -0.5px; margin: 0 0 20px 0;
    }
    .body {
      font: 500 18px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: rgba(255,255,255,0.95); margin: 0;
    }
    .cta-button {
      display: inline-block; position: absolute; bottom: 48px; left: 50%;
      transform: translateX(-50%);
      background: #13bfe0; color: #062344; font: 800 16px/1 sans-serif;
      padding: 18px 36px; border-radius: 999px; text-decoration: none;
      letter-spacing: 0.5px; box-shadow: 0 8px 24px rgba(19,191,224,0.4);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: translateX(-50%) scale(1); }
      50% { transform: translateX(-50%) scale(1.04); }
    }
  </style>
</head>
<body>
  <amp-story
    standalone
    publisher="${PUBLISHER}"
    publisher-logo-src="${PUBLISHER_LOGO}"
    poster-portrait-src="${esc(poster)}"
    title="${esc(input.title)}">
${pages.map((p) => renderPage(p, articleUrl)).join('\n')}
  </amp-story>
</body>
</html>`;
}
