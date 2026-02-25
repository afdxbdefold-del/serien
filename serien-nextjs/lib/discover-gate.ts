/**
 * EMERGENT_DISCOVER_GATE
 * 
 * Entscheidet, ob ein Artikel für Google Discover geeignet ist
 * Fokus: Hero Image, Freshness, Headline & Content Quality
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

interface DiscoverScores {
  discover_probability: number; // 0.0-1.0
  freshness_score: number; // 0-100
  headline_quality: number; // 0-100
  image_quality: number; // 0-100
}

interface DiscoverGateResult {
  discover_eligible: boolean;
  scores: DiscoverScores;
  fail_reasons: string[];
}

// Clickbait patterns forbidden by Discover
const CLICKBAIT_PATTERNS = [
  'Das musst du wissen',
  'Fans dürfen sich freuen',
  'Was wir wissen',
  'Endlich',
  'Mega',
  'Unglaublich',
  'Schockierend',
  'Unfassbar',
  'Das glaubst du nicht',
];

// Press release language patterns
const PRESS_RELEASE_PATTERNS = [
  'offiziell bestätigt',
  'gibt bekannt',
  'verkündet',
  'freut sich bekanntzugeben',
];

export async function discoverGate(input: DiscoverGateInput): Promise<DiscoverGateResult> {
  const fail_reasons: string[] = [];
  
  // Extract plain text from HTML
  const plainText = input.article_html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // === HEADLINE CHECKS ===
  
  // Max length: 70 characters
  if (input.final_headline.length > 70) {
    fail_reasons.push(`Headline zu lang: ${input.final_headline.length} Zeichen (max: 70)`);
  }

  // No clickbait patterns
  const foundClickbait = CLICKBAIT_PATTERNS.filter(pattern =>
    input.final_headline.toLowerCase().includes(pattern.toLowerCase())
  );
  if (foundClickbait.length > 0) {
    fail_reasons.push(`Clickbait-Pattern gefunden: ${foundClickbait.join(', ')}`);
  }

  // No press release language
  const foundPressRelease = PRESS_RELEASE_PATTERNS.filter(pattern =>
    input.final_headline.toLowerCase().includes(pattern.toLowerCase())
  );
  if (foundPressRelease.length > 0) {
    fail_reasons.push(`Press-Release-Sprache in Headline: ${foundPressRelease.join(', ')}`);
  }

  // === HERO IMAGE CHECKS ===
  
  // Minimum width: 1200px
  if (input.hero_image_metadata.width < 1200) {
    fail_reasons.push(
      `Hero Image zu schmal: ${input.hero_image_metadata.width}px (min: 1200px)`
    );
  }

  // === FRESHNESS CHECK ===
  
  // Rolling window: publishedAt >= NOW() - 12h
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  
  const freshness_score = calculateFreshnessScore(input.publishedAt, now);
  
  if (freshness_score < 80) {
    const hoursDiff = Math.floor((now.getTime() - input.publishedAt.getTime()) / (60 * 60 * 1000));
    fail_reasons.push(`Artikel nicht frisch genug: ${hoursDiff}h alt (Freshness Score: ${freshness_score}/100)`);
  }

  // === AI-POWERED SCORING ===
  
  const aiScores = await getDiscoverScores(input, plainText);

  // === PASS/FAIL DECISION ===
  
  const MIN_DISCOVER_PROBABILITY = 0.65;
  const MIN_FRESHNESS_SCORE = 80;
  
  const passed = 
    aiScores.discover_probability >= MIN_DISCOVER_PROBABILITY &&
    freshness_score >= MIN_FRESHNESS_SCORE &&
    input.hero_image_metadata.width >= 1200 &&
    fail_reasons.length === 0;

  return {
    discover_eligible: passed,
    scores: {
      discover_probability: aiScores.discover_probability,
      freshness_score,
      headline_quality: aiScores.headline_quality,
      image_quality: aiScores.image_quality,
    },
    fail_reasons,
  };
}

function calculateFreshnessScore(publishedAt: Date, now: Date): number {
  const hoursDiff = (now.getTime() - publishedAt.getTime()) / (60 * 60 * 1000);
  
  if (hoursDiff <= 2) return 100;
  if (hoursDiff <= 6) return 95;
  if (hoursDiff <= 12) return 85;
  if (hoursDiff <= 24) return 70;
  if (hoursDiff <= 48) return 50;
  return 30;
}

async function getDiscoverScores(
  input: DiscoverGateInput,
  plainText: string
): Promise<DiscoverScores> {
  const systemPrompt = `Du bist ein Google Discover Eligibility Prüfer für deutsche TV-News-Artikel.

AUFGABE: Bewerte den Artikel auf 4 Dimensionen für Google Discover (0-10 Punkte):

1. HEADLINE_QUALITY (0-10):
   - Natürlich und journalistisch?
   - Kein Clickbait?
   - Klare Information?
   
2. IMAGE_QUALITY (0-10):
   - Hochauflösend (≥1200px Breite)?
   - Landscape Format?
   - Klarer Serien-Kontext?
   
3. CONTENT_TRUST (0-10):
   - Faktisch und seriös?
   - Keine Spekulation?
   - Neutrale Sprache?
   
4. FRESHNESS (0-10):
   - Aktuell und relevant?
   - Zeitnah veröffentlicht?
   - Kein altes Datum sichtbar?

Antworte NUR mit JSON:
{
  "headline_quality": 8,
  "image_quality": 9,
  "content_trust": 9,
  "freshness": 10
}`;

  const userPrompt = `HEADLINE:
${input.final_headline}

ARTIKEL:
${plainText}

HERO IMAGE:
- Quelle: ${input.hero_image_metadata.source}
- Auflösung: ${input.hero_image_metadata.width}x${input.hero_image_metadata.height}px

PUBLISHED AT:
${input.publishedAt.toISOString()}

SERIE:
${input.primary_series}

Bewerte jetzt für Google Discover.`;

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

    return {
      headline_quality: parsed.headline_quality,
      image_quality: parsed.image_quality,
      content_trust: parsed.content_trust,
      freshness: parsed.freshness,
      total: parsed.headline_quality + parsed.image_quality + parsed.content_trust + parsed.freshness,
    };

  } catch (error) {
    console.error('AI Discover scoring failed:', error);
    // Return conservative scores on error
    return {
      headline_quality: 7,
      image_quality: 7,
      content_trust: 7,
      freshness: 7,
      total: 28,
    };
  }
}

// CLI usage
if (require.main === module) {
  const testArticle = `<p>Amazon hat eine zweite Staffel der Serie „Fallout" bestätigt. Die Videospiel-Adaption erhält damit eine Fortsetzung nach dem Start der ersten Staffel im Jahr 2024.</p>
<p>Die erste Staffel basierte auf der gleichnamigen Spiele-Reihe und verlegte deren postapokalyptische Welt ins Serienformat.</p>
<p>Showrunner Jonathan Nolan bleibt der Produktion erhalten. Die Dreharbeiten zur zweiten Staffel sollen noch in diesem Jahr beginnen.</p>`;

  discoverGate({
    final_headline: 'Fallout erhält zweite Staffel bei Prime Video',
    article_html: testArticle,
    hero_image_metadata: {
      url: 'https://image.tmdb.org/t/p/w1920_and_h1080_bestv2/backdrop.jpg',
      width: 1920,
      height: 1080,
      source: 'TMDB_BACKDROP',
    },
    publishedAt: new Date(), // NOW
    primary_series: 'Fallout',
  }).then(result => {
    console.log('🎯 DISCOVER GATE RESULT:\n');
    console.log(`Discover Eligible: ${result.discover_eligible ? '✅ YES' : '❌ NO'}`);
    console.log(`\nScores:`);
    console.log(`  Headline Quality: ${result.scores.headline_quality}/10`);
    console.log(`  Image Quality:    ${result.scores.image_quality}/10`);
    console.log(`  Content Trust:    ${result.scores.content_trust}/10`);
    console.log(`  Freshness:        ${result.scores.freshness}/10`);
    console.log(`  Total:            ${result.scores.total}/40`);
    
    if (result.fail_reasons.length > 0) {
      console.log(`\n❌ Fail Reasons:`);
      result.fail_reasons.forEach(reason => console.log(`  - ${reason}`));
    }
    
    if (result.auto_rewrite_recommended) {
      console.log(`\n🔄 Auto-Rewrite empfohlen`);
    }
  });
}
