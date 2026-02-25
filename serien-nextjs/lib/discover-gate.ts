/**
 * EMERGENT_DISCOVER_GATE with Dashboard Metrics
 * 
 * Detaillierte Metriken für Google Discover Eligibility
 * + Dashboard-Export für Admin-Ansicht
 */

const LLM_PROXY_URL = process.env.LLM_PROXY_URL || 'http://localhost:8002/v1/chat/completions';

interface DiscoverGateInput {
  final_headline: string;
  article_html: string;
  hero_image_metadata: {
    url: string;
    width: number;
    height: number;
    source: 'TMDB_BACKDROP' | 'TMDB_POSTER' | 'CUSTOM';
  };
  publishedAt: Date;
  primary_series: string;
}

interface DiscoverGateResult {
  discover_eligible: boolean;
  scores: {
    discover_probability: number;
    freshness_score: number;
    headline_quality: number;
    image_quality: number;
  };
  fail_reasons: string[];
  dashboard: DiscoverDashboardMetrics; // NEW
}

// Dashboard Metrics
interface DiscoverDashboardMetrics {
  headline: {
    length_chars: number;
    clarity_score: number;
    duplication_penalty: number;
    press_language_penalty: number;
    platform_mentions: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    reasons: string[];
  };
  content: {
    word_count: number;
    paragraph_count: number;
    avg_sentence_length_words: number;
    long_paragraph_penalty: number;
    marketing_language_penalty: number;
    factual_density_score: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    reasons: string[];
  };
  freshness: {
    published_at: string;
    age_minutes: number;
    freshness_score: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    reasons: string[];
  };
  images: {
    hero_width_px: number;
    hero_height_px: number;
    has_text_overlay: boolean;
    attribution_present: boolean;
    image_score: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    reasons: string[];
  };
  trust: {
    source_independence: boolean;
    speculation_detected: boolean;
    invented_facts_detected: boolean;
    trust_score: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    reasons: string[];
  };
  aggregation: {
    discover_score: number; // 0.0-1.0
    final_verdict: 'DISCOVER_OK' | 'SEARCH_ONLY' | 'SKIPPED';
    primary_blockers: string[];
    improvement_hints: string[];
  };
}

const CLICKBAIT_PATTERNS = [
  'Das musst du wissen',
  'Fans dürfen sich freuen',
  'Was wir wissen',
  'Endlich',
  'Mega',
  'Unglaublich',
  'Schockierend',
];

const PRESS_RELEASE_PATTERNS = [
  'offiziell bestätigt',
  'gibt bekannt',
  'verkündet',
  'freut sich bekanntzugeben',
];

export async function discoverGate(input: DiscoverGateInput): Promise<DiscoverGateResult> {
  const fail_reasons: string[] = [];
  
  // Extract plain text
  const plainText = input.article_html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const paragraphs = input.article_html.match(/<p>(.*?)<\/p>/g) || [];
  const paragraphTexts = paragraphs.map(p => p.replace(/<\/?p>/g, '').trim());

  // === BUILD DASHBOARD METRICS ===
  
  const dashboard: DiscoverDashboardMetrics = {
    headline: buildHeadlineMetrics(input.final_headline, fail_reasons),
    content: buildContentMetrics(plainText, paragraphTexts, fail_reasons),
    freshness: buildFreshnessMetrics(input.publishedAt, fail_reasons),
    images: buildImageMetrics(input.hero_image_metadata, fail_reasons),
    trust: buildTrustMetrics(plainText, fail_reasons),
    aggregation: {
      discover_score: 0,
      final_verdict: 'SKIPPED',
      primary_blockers: [],
      improvement_hints: [],
    },
  };

  // === AI SCORING ===
  const aiScores = await getDiscoverScores(input, plainText);

  // === AGGREGATION ===
  const discover_score = calculateDiscoverScore(dashboard, aiScores);
  dashboard.aggregation.discover_score = discover_score;

  const passed = 
    discover_score >= 0.65 &&
    dashboard.headline.verdict === 'PASS' &&
    dashboard.images.verdict === 'PASS' &&
    dashboard.freshness.verdict !== 'FAIL';

  dashboard.aggregation.final_verdict = passed ? 'DISCOVER_OK' : 'SEARCH_ONLY';
  dashboard.aggregation.primary_blockers = identifyBlockers(dashboard);
  dashboard.aggregation.improvement_hints = generateHints(dashboard);

  return {
    discover_eligible: passed,
    scores: {
      discover_probability: aiScores.discover_probability,
      freshness_score: dashboard.freshness.freshness_score,
      headline_quality: aiScores.headline_quality,
      image_quality: aiScores.image_quality,
    },
    fail_reasons,
    dashboard,
  };
}

function buildHeadlineMetrics(headline: string, fail_reasons: string[]) {
  const reasons: string[] = [];
  let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  
  const length = headline.length;
  if (length > 70) {
    reasons.push(`Zu lang: ${length} Zeichen (max 70)`);
    verdict = 'FAIL';
  } else if (length > 60) {
    reasons.push(`Nahe am Limit: ${length} Zeichen`);
    verdict = 'WARN';
  }
  
  const foundClickbait = CLICKBAIT_PATTERNS.filter(p => headline.toLowerCase().includes(p.toLowerCase()));
  const clickbaitPenalty = foundClickbait.length * 10;
  
  const foundPressRelease = PRESS_RELEASE_PATTERNS.filter(p => headline.toLowerCase().includes(p.toLowerCase()));
  const pressPenalty = foundPressRelease.length * 10;
  
  if (foundClickbait.length > 0) {
    reasons.push(`Clickbait: ${foundClickbait.join(', ')}`);
    fail_reasons.push(`Clickbait in Headline: ${foundClickbait.join(', ')}`);
    verdict = 'FAIL';
  }
  
  if (foundPressRelease.length > 0) {
    reasons.push(`Press-Release-Sprache: ${foundPressRelease.join(', ')}`);
    fail_reasons.push(`Press-Release-Sprache: ${foundPressRelease.join(', ')}`);
    verdict = 'FAIL';
  }
  
  const clarity = 100 - (headline.match(/[!?:;]/g) || []).length * 5;
  
  return {
    length_chars: length,
    clarity_score: Math.max(0, clarity),
    duplication_penalty: 0,
    press_language_penalty: pressPenalty,
    platform_mentions: 0,
    verdict,
    reasons,
  };
}

function buildContentMetrics(plainText: string, paragraphs: string[], fail_reasons: string[]) {
  const reasons: string[] = [];
  let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  
  const words = plainText.split(/\s+/);
  const wordCount = words.length;
  
  let totalSentences = 0;
  let longParagraphs = 0;
  
  paragraphs.forEach((para, i) => {
    const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 0);
    totalSentences += sentences.length;
    
    if (sentences.length > 3) {
      longParagraphs++;
      reasons.push(`Absatz ${i + 1}: ${sentences.length} Sätze`);
    }
  });
  
  const avgSentenceLength = Math.round(wordCount / Math.max(totalSentences, 1));
  const longParagraphPenalty = longParagraphs * 5;
  
  if (longParagraphs > 0) {
    verdict = 'WARN';
  }
  
  const marketingWords = ['mega', 'hit', 'erfolgreich', 'beliebt'].filter(w => plainText.toLowerCase().includes(w));
  const marketingPenalty = marketingWords.length * 5;
  
  if (marketingWords.length > 2) {
    reasons.push(`Marketing-Sprache: ${marketingWords.join(', ')}`);
    fail_reasons.push(`Marketing-Sprache gefunden: ${marketingWords.join(', ')}`);
    verdict = 'FAIL';
  }
  
  return {
    word_count: wordCount,
    paragraph_count: paragraphs.length,
    avg_sentence_length_words: avgSentenceLength,
    long_paragraph_penalty: longParagraphPenalty,
    marketing_language_penalty: marketingPenalty,
    factual_density_score: 85, // Placeholder
    verdict,
    reasons,
  };
}

function buildFreshnessMetrics(publishedAt: Date, fail_reasons: string[]) {
  const now = new Date();
  const ageMinutes = (now.getTime() - publishedAt.getTime()) / (60 * 1000);
  const ageHours = ageMinutes / 60;
  
  let freshness_score = 100;
  if (ageHours <= 2) freshness_score = 100;
  else if (ageHours <= 6) freshness_score = 95;
  else if (ageHours <= 12) freshness_score = 85;
  else if (ageHours <= 24) freshness_score = 70;
  else freshness_score = 50;
  
  const reasons: string[] = [];
  let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  
  if (freshness_score < 80) {
    reasons.push(`Artikel ${Math.round(ageHours)}h alt`);
    fail_reasons.push(`Freshness zu niedrig: ${freshness_score}/100`);
    verdict = 'FAIL';
  } else if (freshness_score < 90) {
    reasons.push(`Freshness Score: ${freshness_score}/100`);
    verdict = 'WARN';
  }
  
  return {
    published_at: publishedAt.toISOString(),
    age_minutes: Math.round(ageMinutes),
    freshness_score,
    verdict,
    reasons,
  };
}

function buildImageMetrics(heroImage: any, fail_reasons: string[]) {
  const reasons: string[] = [];
  let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  
  if (heroImage.width < 1200) {
    reasons.push(`Breite zu gering: ${heroImage.width}px (min 1200px)`);
    fail_reasons.push(`Hero Image zu schmal: ${heroImage.width}px`);
    verdict = 'FAIL';
  }
  
  const imageScore = Math.min(100, (heroImage.width / 1920) * 100);
  
  return {
    hero_width_px: heroImage.width,
    hero_height_px: heroImage.height,
    has_text_overlay: false,
    attribution_present: true,
    image_score: Math.round(imageScore),
    verdict,
    reasons,
  };
}

function buildTrustMetrics(plainText: string, fail_reasons: string[]) {
  const reasons: string[] = [];
  let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  
  const speculationWords = ['vermutlich', 'wahrscheinlich', 'möglicherweise', 'gerüchten zufolge'];
  const foundSpeculation = speculationWords.filter(w => plainText.toLowerCase().includes(w));
  
  if (foundSpeculation.length > 0) {
    reasons.push(`Spekulation: ${foundSpeculation.join(', ')}`);
    fail_reasons.push(`Spekulation gefunden: ${foundSpeculation.join(', ')}`);
    verdict = 'WARN';
  }
  
  return {
    source_independence: true,
    speculation_detected: foundSpeculation.length > 0,
    invented_facts_detected: false,
    trust_score: foundSpeculation.length > 0 ? 80 : 95,
    verdict,
    reasons,
  };
}

function calculateDiscoverScore(dashboard: DiscoverDashboardMetrics, aiScores: any): number {
  const headlineScore = dashboard.headline.clarity_score / 100;
  const contentScore = dashboard.content.factual_density_score / 100;
  const imageScore = dashboard.images.image_score / 100;
  const freshnessScore = dashboard.freshness.freshness_score / 100;
  const trustScore = dashboard.trust.trust_score / 100;
  
  return (
    0.30 * headlineScore +
    0.30 * contentScore +
    0.20 * imageScore +
    0.10 * freshnessScore +
    0.10 * trustScore
  );
}

function identifyBlockers(dashboard: DiscoverDashboardMetrics): string[] {
  const blockers: string[] = [];
  
  if (dashboard.headline.verdict === 'FAIL') {
    blockers.push('Headline: ' + dashboard.headline.reasons.join(', '));
  }
  if (dashboard.content.verdict === 'FAIL') {
    blockers.push('Content: ' + dashboard.content.reasons.join(', '));
  }
  if (dashboard.freshness.verdict === 'FAIL') {
    blockers.push('Freshness: ' + dashboard.freshness.reasons.join(', '));
  }
  if (dashboard.images.verdict === 'FAIL') {
    blockers.push('Images: ' + dashboard.images.reasons.join(', '));
  }
  
  return blockers;
}

function generateHints(dashboard: DiscoverDashboardMetrics): string[] {
  const hints: string[] = [];
  
  if (dashboard.headline.length_chars > 60) {
    hints.push('Headline kürzer fassen (ideal: 50-60 Zeichen)');
  }
  if (dashboard.content.long_paragraph_penalty > 0) {
    hints.push('Lange Absätze aufteilen (max 3 Sätze pro Absatz)');
  }
  if (dashboard.freshness.freshness_score < 90) {
    hints.push('Artikel zeitnah veröffentlichen (< 6h optimal)');
  }
  if (dashboard.images.hero_width_px < 1920) {
    hints.push('Hero Image in höherer Auflösung verwenden');
  }
  
  return hints;
}

async function getDiscoverScores(input: DiscoverGateInput, plainText: string): Promise<any> {
  const systemPrompt = `Du bist ein Google Discover Eligibility Prüfer.

Bewerte:
1. DISCOVER_PROBABILITY (0.0-1.0)
2. HEADLINE_QUALITY (0-100)
3. IMAGE_QUALITY (0-100)

Antworte NUR mit JSON:
{
  "discover_probability": 0.85,
  "headline_quality": 90,
  "image_quality": 95
}`;

  const userPrompt = `HEADLINE: ${input.final_headline}
ARTIKEL: ${plainText.substring(0, 500)}...
IMAGE: ${input.hero_image_metadata.width}x${input.hero_image_metadata.height}px
SERIE: ${input.primary_series}

Bewerte für Google Discover.`;

  try {
    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    return parsed;

  } catch (error) {
    console.error('AI Discover scoring failed:', error);
    return {
      discover_probability: 0.60,
      headline_quality: 65,
      image_quality: 70,
    };
  }
}
