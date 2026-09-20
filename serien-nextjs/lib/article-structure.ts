import { load } from 'cheerio';
import { marked } from 'marked';

export interface ArticleStructure {
  paragraphs: string[];
  headings: string[];
  text: string;
  wordCount: number;
  score: number;
  issues: string[];
  hardFailure: boolean;
}

export function countArticleWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’/-][\p{L}\p{N}]+)*/gu) || []).length;
}

/** Segment prose, keeping German dates, decimals and common abbreviations intact. */
export function countArticleSentences(text: string): number {
  const protectedText = text
    .replace(/\b(\d+)\.(?=\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Staffel|Folge|Episode)\b)/gi, '$1∯')
    .replace(/\b(?:z\.\s*B\.|u\.\s*a\.|d\.\s*h\.|bzw\.|Dr\.|Prof\.|Mio\.|Mr\.|Mrs\.|Ms\.|Jr\.|Sr\.|St\.)/gi, (value) => value.replace(/\./g, '∯'))
    .replace(/\b(\p{Lu})\.(?=\s*\p{Lu}[\p{L}.])/gu, '$1∯');
  const segmenter = new Intl.Segmenter('de', { granularity: 'sentence' });
  return [...segmenter.segment(protectedText)].filter(({ segment }) => /[\p{L}\p{N}]/u.test(segment)).length;
}

/** Structural checks use document blocks, never an LLM's guess from flattened text. */
export function inspectArticleStructure(content: string, lead?: string): ArticleStructure {
  const html = /<(?:p|div|h[1-6]|article|section|ul|ol|blockquote)\b/i.test(content)
    ? content
    : marked.parse(content, { async: false });
  const $ = load(html);
  $('script, style, iframe, noscript, figure, .related-articles, .advertisement, [data-ad-slot]').remove();
  const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
  const paragraphs = $('p').map((_index, paragraph) => clean($(paragraph).text())).get().filter(Boolean);
  const headings = $('h2, h3').map((_index, heading) => clean($(heading).text())).get().filter(Boolean);
  const text = paragraphs.join('\n\n');
  const wordCount = countArticleWords(text);
  const issues: string[] = [];
  let score = 100;
  let hardFailure = false;

  if (!paragraphs.length || wordCount === 0) {
    issues.push('Artikel enthält keinen gegliederten Fließtext');
    score = 0;
    hardFailure = true;
  } else if (paragraphs.length < (wordCount >= 320 ? 3 : 2)) {
    issues.push('Der Fließtext braucht mindestens zwei, bei längeren Artikeln drei Absätze');
    score -= 40;
  }

  for (const [index, paragraph] of paragraphs.entries()) {
    const sentences = countArticleSentences(paragraph);
    const words = countArticleWords(paragraph);
    if (sentences > 5 || words > 140) {
      issues.push(`Absatz ${index + 1}: Textblock zu lang (${sentences} Sätze, ${words} Wörter)`);
      hardFailure = true;
      score -= 35;
    } else if (sentences > 4 || words > 100) {
      issues.push(`Absatz ${index + 1}: auf höchstens vier Sätze und 100 Wörter kürzen`);
      score -= 15;
    }
  }

  // The excerpt is rendered above the body. The first body paragraph is not the lead.
  if (lead !== undefined && (!lead.trim() || countArticleSentences(lead) > 3 || countArticleWords(lead) > 80)) {
    issues.push('Vorspann muss ein bis drei klare Sätze mit höchstens 80 Wörtern enthalten');
    score -= 35;
  }

  const seen = new Set<string>();
  for (const paragraph of paragraphs) {
    const normalized = paragraph.toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (countArticleWords(paragraph) >= 15 && seen.has(normalized)) {
      issues.push('Ein ganzer Absatz wird wortgleich wiederholt');
      score -= 35;
    }
    seen.add(normalized);
  }

  return { paragraphs, headings, text, wordCount, score: Math.max(0, score), issues, hardFailure };
}
