/**
 * Article Similarity Check (TF-Cosine)
 *
 * Goal: detect when the pipeline is about to generate a near-duplicate of an
 * article we already published in the last 14 days. The existing
 * `duplicate-llm` filter catches "same event, different angle" via an LLM
 * call; this filter is the cheap, deterministic complement — it catches
 * near-verbatim wording overlaps (re-writes of our own old articles, partial
 * paraphrases) where the LLM might say "different event" but Google would
 * see lexical overlap and treat it as self-cannibalization.
 *
 * Approach (chosen for simplicity + low cost):
 *  - Bag-of-Words with normalized term frequency
 *  - German stopword removal + minimum length filter
 *  - Cosine similarity in the joint vocabulary space
 *  - Only compares against published articles from the last 14 days
 *    (older content has decayed in Discover, doesn't compete)
 *
 * Threshold default 0.75 → tuned to flag "rewrite of the same news"
 * without flagging legitimate "two different episodes of the same series".
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// German + English stopwords most common in news writing.
// Not exhaustive — just enough to push real content words to the top.
const STOPWORDS = new Set<string>([
  'aber','alle','allem','allen','aller','alles','als','also','am','an','ander',
  'andere','anderem','anderen','anderer','anderes','andern','anderr','anders',
  'auch','auf','aus','bei','bin','bis','bist','bzw','da','damit','dann','das',
  'dass','dem','den','der','des','dessen','die','dieser','dieses','dir','doch',
  'dort','du','durch','ein','eine','einem','einen','einer','eines','einig',
  'einige','einigem','einigen','einiger','einiges','einmal','er','ihn','ihm',
  'es','etwa','etwas','euer','eure','für','gegen','gibt','habe','haben','hat',
  'hatte','hatten','hier','hin','hinter','ich','ihr','ihre','im','in','ins',
  'ist','jede','jedem','jeden','jeder','jedes','jene','jenem','jenen','jener',
  'jenes','jetzt','kann','kein','keine','keinem','keinen','keiner','keines',
  'können','könnte','machen','man','manche','manchem','manchen','mancher',
  'manches','mein','meine','meinem','meinen','meiner','meines','mich','mir',
  'mit','muss','musste','nach','nicht','nichts','noch','nun','nur','ob','oder',
  'ohne','sehr','sein','seine','seinem','seinen','seiner','seines','selbst',
  'sich','sie','sind','so','solche','solchem','solchen','solcher','solches',
  'soll','sollte','sondern','sonst','über','um','und','uns','unse','unsem',
  'unsen','unser','unses','unter','viel','vom','von','vor','war','waren',
  'warst','was','weg','weil','weiter','welche','welchem','welchen','welcher',
  'welches','wenn','werde','werden','wie','wieder','will','wir','wird','wirst',
  'wo','wollen','wollte','würde','würden','zu','zum','zur','zwar','zwischen',
  // English (kept short since most content is German but some borrowing happens)
  'the','and','for','that','this','with','from','have','has','had','will','was',
  'are','were','its','it','as','at','by','of','on','in','to','an','or','but',
  'not','any','all','can','one','two','more','than','also','about','into',
]);

/**
 * Strip HTML tags + normalize whitespace.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lowercase, split on non-word chars, drop stopwords + words shorter than 4.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    // keep german umlauts in a-z range by stripping diacritics — produces
    // identical tokens for "können" / "konnen" etc.
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-zäöüß0-9]+/i)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

/**
 * Normalized term-frequency vector. Returns Map<term, freq/total>.
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const total = tokens.length || 1;
  for (const [k, v] of tf) tf.set(k, v / total);
  return tf;
}

/**
 * Cosine similarity between two TF maps. Returns 0–1.
 */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  // dot product over the smaller map for efficiency
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, freq] of small) {
    const other = large.get(term);
    if (other) dot += freq * other;
  }
  let magA = 0;
  for (const v of a.values()) magA += v * v;
  let magB = 0;
  for (const v of b.values()) magB += v * v;
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

export interface SimilarityMatch {
  slug: string;
  title: string;
  publishedAt: Date | null;
  similarity: number;
}

export interface SimilarityCheckOptions {
  /** How far back to search for near-duplicates. Default 14 days. */
  windowDays?: number;
  /** Maximum results to return. Default 5. */
  topK?: number;
  /** Excluded slug (the article we're testing — skip self in update flow). */
  excludeSlug?: string;
  /** Minimum tokens in candidate to count. Default 50. */
  minTokens?: number;
}

/**
 * Find published articles whose content is most similar to `candidateText`.
 * Returns top-K matches with similarity scores (0–1).
 *
 * Cost note: O(N * vocab) where N = published articles in window. With ~500
 * articles in a 14-day window this is sub-second even without indices.
 */
export async function findSimilarArticles(
  candidateText: string,
  opts: SimilarityCheckOptions = {},
): Promise<SimilarityMatch[]> {
  const windowDays = opts.windowDays ?? 14;
  const topK = opts.topK ?? 5;
  const minTokens = opts.minTokens ?? 50;
  const since = new Date(Date.now() - windowDays * 86400_000);

  const candidateTokens = tokenize(stripHtml(candidateText));
  if (candidateTokens.length < minTokens) return [];
  const candidateTf = termFrequency(candidateTokens);

  const corpus = await prisma.articles.findMany({
    where: {
      status: 'published',
      publishedAt: { gte: since },
      ...(opts.excludeSlug ? { slug: { not: opts.excludeSlug } } : {}),
    },
    select: { slug: true, title: true, contentHtml: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 1000, // safety cap
  });

  const matches: SimilarityMatch[] = [];
  for (const a of corpus) {
    const aTokens = tokenize(stripHtml(a.contentHtml));
    if (aTokens.length < minTokens) continue;
    const sim = cosineSimilarity(candidateTf, termFrequency(aTokens));
    matches.push({
      slug: a.slug,
      title: a.title,
      publishedAt: a.publishedAt,
      similarity: sim,
    });
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches.slice(0, topK);
}
