import { load } from 'cheerio';
import { Lexer, walkTokens, type Token } from 'marked';

export interface PersonLinkTarget { name: string; slug: string }

const normalize = (name: string) => name.normalize('NFC').trim().replace(/\s+/gu, ' ');
const nameKey = (name: string) => normalize(name).toLocaleLowerCase('de-DE');
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PROTECTED_HTML = 'a,h1,h2,h3,h4,h5,h6,code,pre,script,style,textarea,svg';

/** A catalogue hit is not identity evidence for a bare surname or mononym. */
function uniqueFullNames(persons: readonly PersonLinkTarget[]): PersonLinkTarget[] {
  const names = new Map<string, Set<string>>();
  const slugs = new Map<string, Set<string>>();
  for (const person of persons) {
    const key = nameKey(person.name);
    names.set(key, (names.get(key) || new Set()).add(person.slug));
    slugs.set(person.slug, (slugs.get(person.slug) || new Set()).add(key));
  }
  const seen = new Set<string>();
  return persons.filter(person => {
    const name = normalize(person.name);
    const key = nameKey(name);
    if (seen.has(key) || names.get(key)?.size !== 1 || slugs.get(person.slug)?.size !== 1
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(person.slug)
      || name.split(' ').length < 2
      || !name.split(' ').every(part => /\p{L}/u.test(part) && /^[\p{L}\p{M}.'’-]+$/u.test(part))) return false;
    seen.add(key);
    return true;
  }).map(person => ({ name: normalize(person.name), slug: person.slug }))
    .sort((a, b) => b.name.length - a.name.length);
}

function namePattern(name: string): RegExp {
  // Unicode boundaries also exclude possessives/hyphenated longer names.
  const body = name.split(' ').map(escapeRegex).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_'’-])${body}(?![\\p{L}\\p{N}\\p{M}_'’-])`, 'u');
}

function localPersonPath(href: string): { url: URL; path: string } | null {
  try {
    const url = new URL(href, 'https://serien.de');
    if (!['serien.de', 'www.serien.de'].includes(url.hostname.toLowerCase().replace(/\.+$/, ''))) return null;
    let path = url.pathname;
    // URL aliases must not let an encoded /person route evade identity checks.
    for (let attempt = 0; attempt < 3 && /%[0-9a-f]{2}/i.test(path); attempt++) {
      try { path = decodeURIComponent(path); } catch { break; }
    }
    return { url, path };
  } catch { return null; }
}

function personSlug(href: string): string | null {
  const target = localPersonPath(href);
  if (!target || !/^https?:$/.test(target.url.protocol) || target.url.username || target.url.password || target.url.port) return null;
  return target.path.match(/^\/person\/([^/]+)\/?$/)?.[1] || null;
}

function isPersonHref(href: string): boolean {
  const target = localPersonPath(href);
  return /^\/person(?:\/|$)/.test(target?.path || href);
}

/** Remove unverified person destinations, never the visible wording/formatting. */
export function sanitizePersonLinks(html: string, persons: readonly PersonLinkTarget[]): { html: string; removed: number } {
  const targets = new Map(uniqueFullNames(persons).map(person => [person.slug, person.name]));
  const $ = load(html, null, false);
  let removed = 0;
  $('a[href]').each((_index, node) => {
    const link = $(node);
    const href = link.attr('href') || '';
    if (!isPersonHref(href)) return;
    const slug = personSlug(href);
    const name = slug ? targets.get(slug) : undefined;
    if (!name || normalize(link.text()) !== name || link.find('img,video,svg').length) {
      link.replaceWith(link.contents());
      removed++;
    }
  });
  return { html: removed ? $.html() : html, removed };
}

interface TextRange { start: number; end: number }

function inlineTextRanges(tokens: Token[], start: number): TextRange[] {
  // Raw HTML may open <a>/<code> across tokens. Omit optional links in that
  // paragraph instead of guessing its nesting from regular expressions.
  if (tokens.some(token => token.type === 'html')) return [];
  const ranges: TextRange[] = [];
  let cursor = start;
  for (const token of tokens) {
    if (token.type === 'text' && !token.tokens) {
      ranges.push({ start: cursor, end: cursor + token.raw.length });
    } else if ((token.type === 'strong' || token.type === 'em' || token.type === 'del') && token.tokens) {
      const inner = token.tokens.map((child: Token) => child.raw).join('');
      const offset = token.raw.indexOf(inner);
      if (inner && offset >= 0 && offset === token.raw.lastIndexOf(inner)) {
        ranges.push(...inlineTextRanges(token.tokens, cursor + offset));
      }
    }
    cursor += token.raw.length;
  }
  return ranges;
}

/** Edit only proven prose text spans; preserve every other Markdown byte. */
export function linkPersonNamesInMarkdown(markdown: string, persons: readonly PersonLinkTarget[]): { linkedMarkdown: string; castLinked: number } {
  const tokens = Lexer.lex(markdown, { gfm: true });
  // Marked can normalize whitespace. If offsets no longer map exactly, omit
  // optional links. Headings, code, tables and reference definitions stay intact.
  if (tokens.map(token => token.raw).join('') !== markdown) return { linkedMarkdown: markdown, castLinked: 0 };
  const linked = new Set<string>();
  walkTokens(tokens, token => {
    if (token.type === 'link') {
      const slug = personSlug(token.href);
      if (slug) linked.add(slug);
    }
  });
  const ranges: TextRange[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.type === 'paragraph' && token.tokens
      && token.raw.startsWith(token.tokens.map((child: Token) => child.raw).join(''))) {
      ranges.push(...inlineTextRanges(token.tokens, cursor));
    }
    cursor += token.raw.length;
  }
  const replacements: Array<TextRange & { text: string }> = [];
  for (const person of uniqueFullNames(persons)) {
    if (linked.has(person.slug)) continue;
    const pattern = namePattern(person.name);
    for (const range of ranges) {
      const match = pattern.exec(markdown.slice(range.start, range.end));
      if (!match) continue;
      const start = range.start + match.index;
      const end = start + match[0].length;
      if (replacements.some(existing => start < existing.end && end > existing.start)) continue;
      replacements.push({ start, end, text: `[${match[0]}](/person/${person.slug})` });
      linked.add(person.slug);
      break;
    }
  }
  let linkedMarkdown = markdown;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    linkedMarkdown = linkedMarkdown.slice(0, replacement.start) + replacement.text + linkedMarkdown.slice(replacement.end);
  }
  return { linkedMarkdown, castLinked: replacements.length };
}

/** Legacy HTML callers use the same identity rule and actual DOM ancestors. */
export function linkPersonNamesInHtml(html: string, persons: readonly PersonLinkTarget[]): { html: string; linked: number } {
  const $ = load(html, null, false);
  const existing = new Set<string>();
  $('a[href]').each((_index, node) => {
    const slug = personSlug($(node).attr('href') || '');
    if (slug) existing.add(slug);
  });
  let linked = 0;
  for (const person of uniqueFullNames(persons)) {
    if (existing.has(person.slug)) continue;
    const pattern = namePattern(person.name);
    const nodes = $.root().find('*').addBack().contents().toArray();
    for (const node of nodes) {
      if (node.type !== 'text' || $(node).parents(PROTECTED_HTML).length) continue;
      const match = pattern.exec(node.data);
      if (!match) continue;
      const before = node.data.slice(0, match.index);
      const after = node.data.slice(match.index + match[0].length);
      const replacement = $('<span></span>').text(before);
      replacement.append($('<a></a>').attr('href', `/person/${person.slug}`).text(match[0]));
      replacement.append($('<span></span>').text(after).contents());
      $(node).replaceWith(replacement.contents());
      linked++;
      existing.add(person.slug);
      break;
    }
  }
  return { html: linked ? $.html() : html, linked };
}
