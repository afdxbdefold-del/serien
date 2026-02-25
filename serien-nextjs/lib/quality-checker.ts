/**
 * EMERGENT_QUALITY_CHECK
 * 
 * Neue Scoring-Logik: HEADLINE, CONTENT, STRUCTURE
 * Min Scores: 70/70/65
 */

const LLM_PROXY_URL = process.env.LLM_PROXY_URL || 'http://localhost:8002/v1/chat/completions';

interface QualityCheckInput {
  generatedArticleHtml: string;
  finalHeadline: string;
  primarySeriesName: string;
  platform?: string;
  extractedFacts?: string;
}

interface QualityScores {
  headline: number; // 0-100
  content: number; // 0-100
  structure: number; // 0-100
}

interface QualityCheckResult {
  status: 'PASS' | 'FAIL';
  scores: QualityScores;
  failReasons: string[];
  requiresFullRewrite: boolean; // If body has issues, allow full rewrite
}

export async function qualityCheck(input: QualityCheckInput): Promise<QualityCheckResult> {
  const testArticle = `<p>Amazon hat eine zweite Staffel der Serie „Fallout" bestätigt. Die Videospiel-Adaption erhält damit eine Fortsetzung.</p>
<p>Die erste Staffel basierte auf der gleichnamigen Spiele-Reihe. Sie erschien 2024 und markierte den Einstieg ins Serienformat.</p>
<p>Showrunner Jonathan Nolan bleibt der Produktion erhalten. Die Dreharbeiten zur zweiten Staffel sollen noch in diesem Jahr beginnen.</p>`;

  qualityCheck({
    generatedArticleHtml: testArticle,
    finalHeadline: 'Fallout: Zweite Staffel bestätigt',
    primarySeriesName: 'Fallout',
    platform: 'Prime Video',
  }).then(result => {
    console.log('✅ QUALITY CHECK RESULT:\n');
    console.log(`Status: ${result.status}`);
    console.log(`\nScores:`);
    console.log(`  Headline:  ${result.scores.headline}/100`);
    console.log(`  Content:   ${result.scores.content}/100`);
    console.log(`  Structure: ${result.scores.structure}/100`);
    
    if (result.failReasons.length > 0) {
      console.log(`\n❌ Fail Reasons:`);
      result.failReasons.forEach(reason => console.log(`  - ${reason}`));
    }
    
    if (result.requiresFullRewrite) {
      console.log(`\n🔄 Requires FULL Rewrite (body issues detected)`);
    }
  });
}

  const failReasons: string[] = [];
  let requiresFullRewrite = false;
  
  // Extract text from HTML
  const plainText = input.generatedArticleHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract paragraphs
  const paragraphs = input.generatedArticleHtml.match(/<p>(.*?)<\/p>/g) || [];
  const paragraphTexts = paragraphs.map(p => p.replace(/<\/?p>/g, '').trim());

  // === STRUCTURE CHECKS ===
  
  if (paragraphTexts.length < 3) {
    failReasons.push(`Zu wenige Absätze: ${paragraphTexts.length} (min: 3)`);
    requiresFullRewrite = true;
  }

  // Check paragraph lengths
  paragraphTexts.forEach((para, i) => {
    const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = para.split(/\s+/).length;
    
    if (i === 0 && sentences.length > 2) {
      failReasons.push(`Lead zu lang: ${sentences.length} Sätze (max: 2)`);
    } else if (i > 0 && sentences.length > 3) {
      failReasons.push(`Absatz ${i + 1}: zu viele Sätze (${sentences.length}, max: 3)`);
      requiresFullRewrite = true;
    }
    
    if (words > 60) {
      failReasons.push(`Absatz ${i + 1}: zu viele Wörter (${words}, max: 60)`);
      requiresFullRewrite = true;
    }
  });

  // === HEADLINE CHECKS ===
  
  if (input.finalHeadline.length > 70) {
    failReasons.push(`Headline zu lang: ${input.finalHeadline.length} Zeichen (max: 70)`);
  }

  // === CONTENT CHECKS ===
  
  // Check for reader address
  const readerAddressPatterns = /\b(ihr|du|wir|euch|uns)\b/gi;
  const readerMatches = plainText.match(readerAddressPatterns);
  if (readerMatches && readerMatches.length > 0) {
    failReasons.push(`Leser-Ansprache gefunden: ${readerMatches.slice(0, 3).join(', ')}`);
    requiresFullRewrite = true;
  }

  // Check platform mentions
  if (input.platform) {
    const platformMentions = (plainText.match(new RegExp(input.platform, 'gi')) || []).length;
    if (platformMentions > 1) {
      failReasons.push(`Plattform zu oft erwähnt: ${platformMentions}x (max: 1)`);
    }
  }

  // === AI-POWERED QUALITY SCORING ===
  
  const scores = await getAIQualityScores(input, plainText);

  // === PASS/FAIL DECISION ===
  
  const MIN_HEADLINE_SCORE = 70;
  const MIN_CONTENT_SCORE = 70;
  const MIN_STRUCTURE_SCORE = 65;
  
  const passed = 
    scores.headline >= MIN_HEADLINE_SCORE &&
    scores.content >= MIN_CONTENT_SCORE &&
    scores.structure >= MIN_STRUCTURE_SCORE &&
    failReasons.length === 0;

  return {
    status: passed ? 'PASS' : 'FAIL',
    scores,
    failReasons,
    requiresFullRewrite,
  };
}

async function getAIQualityScores(
  input: QualityCheckInput,
  plainText: string
): Promise<QualityScores> {
  const systemPrompt = `Du bist ein Qualitätsprüfer für deutsche TV-News-Artikel im Stil von serienjunkies.de.

AUFGABE: Bewerte den Artikel auf 3 Dimensionen (0-100 Punkte):

1. HEADLINE (0-100):
   - Max 70 Zeichen?
   - Klar und informativ?
   - Serienname enthalten?
   - Kein Clickbait?
   
2. CONTENT (0-100):
   - Faktisch und neutral?
   - Keine Marketing-Sprache?
   - Keine Leser-Ansprache?
   - Professionell geschrieben?
   
3. STRUCTURE (0-100):
   - Lead max 2 Sätze?
   - Absätze max 3 Sätze?
   - Gute Lesbarkeit?
   - Min 3 Absätze?

Antworte NUR mit JSON:
{
  "headline": 85,
  "content": 90,
  "structure": 80
}`;

  const userPrompt = `HEADLINE:
${input.finalHeadline}

ARTIKEL:
${plainText}

SERIE:
${input.primarySeriesName}

Bewerte die Qualität (0-100 Punkte pro Kategorie).`;

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
      headline: parsed.headline,
      content: parsed.content,
      structure: parsed.structure,
    };

  } catch (error) {
    console.error('AI scoring failed:', error);
    // Return conservative scores on error
    return {
      headline: 65,
      content: 65,
      structure: 60,
    };
  }
}
