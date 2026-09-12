import { load as cheerioLoad } from 'cheerio';

const ALLOWED_ARTICLE_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'cite', 'code', 'dd', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li',
  'mark', 'ol', 'p', 'pre', 's', 'section', 'small', 'span', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'video', 'source',
]);
const GLOBAL_ARTICLE_ATTRIBUTES = new Set(['dir', 'lang', 'role', 'title']);
const ALLOWED_ARTICLE_CLASSES = new Set(['related-articles']);
const ARTICLE_ATTRIBUTES_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'target']),
  blockquote: new Set(['cite']),
  img: new Set(['alt', 'decoding', 'height', 'loading', 'src', 'width']),
  source: new Set(['src', 'type']),
  table: new Set(['summary']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  time: new Set(['datetime']),
  video: new Set(['controls', 'height', 'playsinline', 'poster', 'preload', 'src', 'width']),
};
const URL_ARTICLE_ATTRIBUTES = new Set(['cite', 'href', 'poster', 'src']);
const LOCAL_MEDIA_PATH_PREFIXES = [
  '/img/', '/images/', '/branding/', '/placeholders/', '/series-backdrops/',
  '/hero-samples/', '/og-samples/', '/api/trailer/',
];
const SITE_MEDIA_HOSTS = new Set(['serien.de', 'www.serien.de']);
const EXTERNAL_MEDIA_HOSTS = new Set(['image.tmdb.org']);

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.endsWith('.local') || host.includes(':')) return true;
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

function addConfiguredHost(target: Set<string>, rawUrl: string | undefined): void {
  if (!rawUrl) return;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' && parsed.port === '' && !isPrivateHostname(parsed.hostname)) {
      target.add(parsed.hostname.toLowerCase().replace(/\.$/, ''));
    }
  } catch {
    // Invalid configuration must not broaden the media allowlist.
  }
}

function getAllowedMediaHosts(): { site: Set<string>; external: Set<string> } {
  const site = new Set(SITE_MEDIA_HOSTS);
  const external = new Set(EXTERNAL_MEDIA_HOSTS);
  addConfiguredHost(site, process.env.NEXT_PUBLIC_BASE_URL);
  addConfiguredHost(site, process.env.NEXT_PUBLIC_SITE_URL);
  addConfiguredHost(external, process.env.R2_PUBLIC_URL);
  addConfiguredHost(external, process.env.NEXT_PUBLIC_R2_URL);
  addConfiguredHost(external, process.env.BLOB_PUBLIC_URL);
  addConfiguredHost(external, process.env.NEXT_PUBLIC_BLOB_URL);
  return { site, external };
}

function isSafeNavigationUrl(value: string): boolean {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  if (!trimmed || trimmed.includes('\\') || /^(?:data|javascript|vbscript):/.test(compact)) return false;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol)
      && parsed.port === ''
      && parsed.username === ''
      && parsed.password === ''
      && !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function isSafePublicHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\\')) return false;
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol)
      && parsed.port === ''
      && parsed.username === ''
      && parsed.password === ''
      && !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function isSafeMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\\') || trimmed.startsWith('//')) return false;
  try {
    const relative = trimmed.startsWith('/');
    const parsed = new URL(trimmed, 'https://serien.de');
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const allowedHosts = getAllowedMediaHosts();
    if (relative) {
      return parsed.origin === 'https://serien.de'
        && LOCAL_MEDIA_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
    }
    return parsed.protocol === 'https:'
      && parsed.port === ''
      && parsed.username === ''
      && parsed.password === ''
      && !isPrivateHostname(hostname)
      && (allowedHosts.external.has(hostname)
        || (allowedHosts.site.has(hostname)
          && LOCAL_MEDIA_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))));
  } catch {
    return false;
  }
}

export interface ArticleHtmlSafetyResult {
  ok: boolean;
  reason: string;
  normalizedHtml: string;
}

/**
 * Parse and normalize generated/editor-edited article HTML against a strict
 * allowlist. Unsafe markup is rejected instead of partially cleaned, so an
 * editor can see and remove the exact blocked construct before publication.
 */
export function validateAndNormalizeArticleHtml(rawHtml: string): ArticleHtmlSafetyResult {
  const $ = cheerioLoad(rawHtml, {}, false);
  let failureReason = '';

  $('*').each((_, element) => {
    if (failureReason) return;
    const tag = String($(element).prop('tagName') || '').toLowerCase();
    if (!ALLOWED_ARTICLE_TAGS.has(tag)) {
      failureReason = `Nicht erlaubtes HTML-Element <${tag}>`;
      return;
    }

    const tagAttributes = ARTICLE_ATTRIBUTES_BY_TAG[tag] || new Set<string>();
    const attributes = $(element).attr();
    for (const [rawName, value] of Object.entries(attributes)) {
      const name = rawName.toLowerCase();
      const allowed = name === 'class'
        || GLOBAL_ARTICLE_ATTRIBUTES.has(name)
        || name.startsWith('aria-')
        || tagAttributes.has(name);
      if (!allowed || name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        failureReason = `Nicht erlaubtes HTML-Attribut ${name}`;
        return;
      }
      if (name === 'class') {
        const classes = value.split(/\s+/).filter(Boolean);
        if (classes.length === 0 || classes.some((className) => !ALLOWED_ARTICLE_CLASSES.has(className))) {
          failureReason = 'Nicht erlaubte CSS-Klasse im Artikelinhalt';
          return;
        }
      }
      if (URL_ARTICLE_ATTRIBUTES.has(name)) {
        const safeUrl = name === 'poster' || name === 'src'
          ? isSafeMediaUrl(value)
          : isSafeNavigationUrl(value);
        if (!safeUrl) {
          failureReason = `Unsichere URL im HTML-Attribut ${name}`;
          return;
        }
      }
      if (tag === 'video' && name === 'preload' && !['none', 'metadata'].includes(value.toLowerCase())) {
        failureReason = 'Video-Preload muss none oder metadata sein';
        return;
      }
      if (tag === 'a' && name === 'target' && value !== '_blank') {
        failureReason = 'Nicht erlaubtes Link-Ziel';
        return;
      }
      if (tag === 'a' && name === 'rel' && /(?:^|\s)opener(?:\s|$)/i.test(value)) {
        failureReason = 'Unsichere rel=opener-Konfiguration';
        return;
      }
    }

    if (tag === 'a' && $(element).attr('target') === '_blank') {
      $(element).attr('rel', 'noopener noreferrer');
    }
  });

  if (failureReason) return { ok: false, reason: failureReason, normalizedHtml: '' };
  return {
    ok: true,
    reason: 'HTML-Sicherheitsprüfung bestanden',
    normalizedHtml: $.html().trim(),
  };
}
