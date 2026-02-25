/**
 * EMERGENT_EDITORIAL_REWRITER
 * 
 * Kombinierter Rewriter für Headline + Artikelinhalt
 * - Headline: Max 70 Zeichen, 5 Varianten, beste auswählen
 * - Content: Erste 2 Paragraphs rewriten (Lead max 2 Sätze)
 * - Rest: Unverändert vom Generate übernehmen
 */

const LLM_PROXY_URL = process.env.LLM_PROXY_URL || 'http://localhost:8002/v1/chat/completions';

interface EditorialRewriteInput {
  generatedArticleHtml: string;
  generatedHeadline: string;
  extractedFacts: string;
  seriesName: string;
  platform: string;
}

interface EditorialRewriteResult {
  final_headline: string;
  rewritten_article_html: string;
  headline_variants: string[];
}

// Forbidden phrases in headline (STRICT)
const FORBIDDEN_HEADLINE_PHRASES = [
  'offiziell',
  'bestellt',
  'Hit-Serie',
  'Mega',
  'endlich',
  'Fans dürfen sich freuen',
  'bestätigt offiziell',
  'gibt bekannt',
];

export async function editorialRewrite(input: EditorialRewriteInput): Promise<EditorialRewriteResult> {
  // Step 1: Generate 5 headline variants
  const headlineVariants = await generateHeadlineVariants(input);
  
  // Step 2: Select best headline (clarity → shortest)
  const finalHeadline = selectBestHeadline(headlineVariants);
  
  // Step 3: Rewrite first 2 paragraphs + lead
  const rewrittenArticle = await rewriteFirstTwoParagraphs(input, finalHeadline);
  
  return {
    final_headline: finalHeadline,
    rewritten_article_html: rewrittenArticle,
    headline_variants: headlineVariants,
  };
}

async function generateHeadlineVariants(input: EditorialRewriteInput): Promise<string[]> {
  const systemPrompt = `Du bist ein Headline-Editor für serienjunkies.de.

AUFGABE: Generiere 5 verschiedene Headlines im Stil von serienjunkies.de.

HEADLINE-REGELN:
- Präzise, nicht emotional
- Serienname + konkretes Ereignis
- Max. 70 Zeichen
- Sachlich, nüchtern, journalistisch
- KEIN Clickbait, keine Fragen

STRUKTUR:
"[Serienname]: [Konkretes Ereignis]"

Beispiele:
✅ "Fallout: Staffel 2 startet Dreharbeiten 2026"
✅ "Stranger Things endet mit Staffel 5"
❌ "Fallout Staffel 2: Das musst du wissen!"
❌ "Wird Stranger Things verlängert?"

ABSOLUT VERBOTEN:
- ${FORBIDDEN_HEADLINE_PHRASES.join('\n- ')}
- Fragezeichen
- Ausrufezeichen
- "offiziell bestätigt"

Antworte NUR mit JSON:
{
  "headlines": [
    "Headline 1",
    "Headline 2",
    "Headline 3",
    "Headline 4",
    "Headline 5"
  ]
}`;

  const userPrompt = `FAKTEN:
${input.extractedFacts}

ORIGINAL HEADLINE:
${input.generatedHeadline}

SERIE: ${input.seriesName}
PLATTFORM: ${input.platform}

Generiere 5 Varianten (max 70 Zeichen).`;

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
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    // Filter out forbidden phrases and trim to 70 chars
    return parsed.headlines
      .filter((h: string) => {
        const lower = h.toLowerCase();
        return !FORBIDDEN_HEADLINE_PHRASES.some(phrase => lower.includes(phrase.toLowerCase()));
      })
      .map((h: string) => h.substring(0, 70))
      .slice(0, 5);

  } catch (error) {
    console.error('Headline generation failed:', error);
    // Fallback: use original headline, trimmed
    return [input.generatedHeadline.substring(0, 70)];
  }
}

function selectBestHeadline(variants: string[]): string {
  if (variants.length === 0) {
    return 'Untitled';
  }
  
  // Select by: highest clarity (no special chars, simple words) → shortest
  const scored = variants.map(h => ({
    headline: h,
    clarity: calculateClarity(h),
    length: h.length,
  }));
  
  // Sort by clarity DESC, then length ASC
  scored.sort((a, b) => {
    if (b.clarity !== a.clarity) {
      return b.clarity - a.clarity;
    }
    return a.length - b.length;
  });
  
  return scored[0].headline;
}

function calculateClarity(headline: string): number {
  let score = 100;
  
  // Penalty for special chars
  const specialChars = (headline.match(/[!?:;]/g) || []).length;
  score -= specialChars * 5;
  
  // Penalty for long words
  const words = headline.split(/\s+/);
  const longWords = words.filter(w => w.length > 12).length;
  score -= longWords * 10;
  
  // Bonus for series name being early
  score += 10;
  
  return Math.max(0, score);
}

async function rewriteFirstTwoParagraphs(
  input: EditorialRewriteInput,
  finalHeadline: string
): Promise<string> {
  // Extract all paragraphs from generated article
  const paragraphs = input.generatedArticleHtml.match(/<p>(.*?)<\/p>/g) || [];
  
  if (paragraphs.length < 2) {
    // Not enough paragraphs, return as-is
    return input.generatedArticleHtml;
  }
  
  const systemPrompt = `Du bist ein Editor für serienjunkies.de.

AUFGABE: Schreibe die ersten 2 Absätze eines TV-Artikel im serienjunkies.de Stil neu.

REGELN:
- LEAD (Absatz 1): Max 2 Sätze, präzise, sachlich
- ABSATZ 2: Max 3 Sätze, max 60 Wörter
- Keine Marketing-Sprache, kein Hype
- Keine Leser-Ansprache (kein "du", "wir", "ihr")
- Keine Spekulation
- Nur Fakten verwenden
- NUR <p> Tags

KEINE neuen Fakten hinzufügen!

Antworte NUR mit HTML (2 Paragraphs):
<p>Lead...</p>
<p>Absatz 2...</p>`;

  const firstTwoParagraphs = paragraphs.slice(0, 2).join('\n');
  
  const userPrompt = `HEADLINE:
${finalHeadline}

FAKTEN:
${input.extractedFacts}

ORIGINAL ERSTE 2 ABSÄTZE:
${firstTwoParagraphs}

Schreibe neu (serienjunkies.de Stil).`;

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
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.choices[0].message.content.trim();
    
    // Combine rewritten first 2 paragraphs + rest from original
    const restParagraphs = paragraphs.slice(2).join('\n');
    
    return `${rewrittenContent}\n${restParagraphs}`;

  } catch (error) {
    console.error('Editorial rewrite failed:', error);
    // Fallback: return original
    return input.generatedArticleHtml;
  }
}

// CLI usage
if (require.main === module) {
  const testInput = {
    generatedArticleHtml: `<p>Amazon Prime Video hat offiziell die zweite Staffel der erfolgreichen Fallout-Serie bestätigt. Die Videospiel-Adaption war einer der größten Hits des Jahres 2024 und begeisterte Kritiker und Zuschauer gleichermaßen.</p>
<p>Ella Purnell und Walton Goggins kehren in ihren Hauptrollen zurück. Die erste Staffel erzählte die Geschichte einer Vault-Bewohnerin und eines Ghuls in der postapokalyptischen Welt.</p>
<p>Die Dreharbeiten zur zweiten Staffel beginnen im Sommer 2026. Jonathan Nolan und Lisa Joy bleiben als ausführende Produzenten an Bord.</p>
<p>Ein konkreter Starttermin für Staffel zwei liegt noch nicht vor. Weitere Details zur Handlung werden in den kommenden Monaten erwartet.</p>`,
    generatedHeadline: 'Fallout Staffel 2: Amazon bestätigt Fortsetzung der Videospiel-Adaption',
    extractedFacts: `- Amazon hat Staffel 2 von Fallout bestätigt
- Ella Purnell und Walton Goggins kehren zurück
- Dreharbeiten beginnen Sommer 2026
- Jonathan Nolan und Lisa Joy bleiben Produzenten`,
    seriesName: 'Fallout',
    platform: 'Prime Video',
  };

  editorialRewrite(testInput).then(result => {
    console.log('✅ EDITORIAL REWRITE RESULT:\n');
    console.log(`FINAL HEADLINE (${result.final_headline.length} chars):`);
    console.log(`"${result.final_headline}"\n`);
    
    console.log('HEADLINE VARIANTS:');
    result.headline_variants.forEach((h, i) => {
      console.log(`  ${i + 1}. "${h}" (${h.length} chars)`);
    });
    
    console.log('\nREWRITTEN ARTICLE:');
    const paras = result.rewritten_article_html.match(/<p>(.*?)<\/p>/g) || [];
    paras.forEach((p, i) => {
      const text = p.replace(/<\/?p>/g, '');
      console.log(`\n[Absatz ${i + 1}]`);
      console.log(text);
    });
  });
}
