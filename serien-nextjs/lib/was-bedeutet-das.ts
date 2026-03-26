/**
 * WAS_BEDEUTET_DAS Generator
 * 
 * Erklärt in 1-2 nüchternen Sätzen die praktische Bedeutung einer News
 * Max 2 Sätze, max 35 Wörter, keine Emotion
 */

const LLM_PROXY_URL = 'https://api.openai.com/v1/chat/completions';

interface WasBedeutetDasInput {
  articleHtml: string;
  headline: string;
  seriesName: string;
  contentType: string;
  extractedFacts: string;
}

const FORBIDDEN_WORDS = [
  'fans',
  'freuen',
  'erfolg',
  'highlight',
  'toll',
  'großartig',
  'endlich',
];

const NEWS_CHANGE_KEYWORDS = [
  'verlänger',
  'abgesetzt',
  'beendet',
  'finale',
  'staffel',
  'dreharbeiten',
  'bestätigt',
  'start',
  'premiere',
];

export async function generateWasBedeutetDas(
  input: WasBedeutetDasInput
): Promise<string | null> {
  // Check eligibility
  if (!isEligible(input)) {
    return null;
  }

  // Generate via LLM
  const text = await generateViaLLM(input);

  if (!text) {
    return null;
  }

  // Validate
  if (!isValid(text)) {
    return null;
  }

  return text;
}

function isEligible(input: WasBedeutetDasInput): boolean {
  // Only NEWS articles
  if (input.contentType !== 'SINGLE_SERIES_NEWS') {
    return false;
  }

  // Must have concrete change
  const plainText = (input.headline + ' ' + input.articleHtml).toLowerCase();
  const hasChange = NEWS_CHANGE_KEYWORDS.some(keyword => plainText.includes(keyword));

  return hasChange;
}

async function generateViaLLM(input: WasBedeutetDasInput): Promise<string | null> {
  const systemPrompt = `Du bist ein nüchterner Fakten-Erklärer.

AUFGABE: Erkläre in 1-2 sachlichen Sätzen, welche praktische Bedeutung diese TV-Serien-News hat.

REGELN:
- Max. 2 Sätze
- Max. 35 Wörter gesamt
- Sachlich, nüchtern, journalistisch
- Keine Emotion, kein Hype
- Keine Meinung, kein Serienlob
- Keine Zukunftsspekulation

STRUKTUR:
Satz 1: Konkrete Auswirkung (Was ändert sich?)
Satz 2 (optional): Einschränkung oder Kontext

BEISPIELE (GUT):
✔ "Die Serie wird fortgesetzt, ein Starttermin für die neue Staffel steht aber noch nicht fest."
✔ "Damit ist die Geschichte abgeschlossen. Weitere Folgen sind nicht geplant."
✔ "Die Produktion geht weiter, konkrete Details zur Handlung gibt es bislang nicht."

VERBOTEN:
✘ "Fans dürfen sich freuen"
✘ "Ein großer Erfolg"
✘ "Das sind tolle Neuigkeiten"
✘ Ausrufezeichen
✘ Fragezeichen
✘ Superlative

Antworte NUR mit dem Text (kein JSON, keine Anführungszeichen).`;

  const userPrompt = `HEADLINE:
${input.headline}

FAKTEN:
${input.extractedFacts}

SERIE:
${input.seriesName}

Erkläre die praktische Bedeutung (max 2 Sätze, max 35 Wörter).`;

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
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();
    
    // Remove quotes if LLM added them
    return text.replace(/^["']|["']$/g, '');

  } catch (error) {
    console.error('WasBedeutetDas generation failed:', error);
    return null;
  }
}

function isValid(text: string): boolean {
  // Check word count
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 35) {
    console.log(`WasBedeutetDas: zu lang (${wordCount} Wörter)`);
    return false;
  }

  // Check sentence count
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 2) {
    console.log(`WasBedeutetDas: zu viele Sätze (${sentences.length})`);
    return false;
  }

  // Anti-KI Check: No exclamation marks
  if (text.includes('!')) {
    console.log('WasBedeutetDas: Ausrufezeichen gefunden');
    return false;
  }

  // Anti-KI Check: No question marks
  if (text.includes('?')) {
    console.log('WasBedeutetDas: Fragezeichen gefunden');
    return false;
  }

  // Anti-KI Check: No forbidden words
  const lowerText = text.toLowerCase();
  const foundForbidden = FORBIDDEN_WORDS.filter(word => lowerText.includes(word));
  if (foundForbidden.length > 0) {
    console.log(`WasBedeutetDas: Verbotene Wörter: ${foundForbidden.join(', ')}`);
    return false;
  }

  // Anti-KI Check: No superlatives
  const superlatives = ['beste', 'größte', 'erfolgreichste', 'beliebteste', 'wichtigste'];
  const foundSuperlatives = superlatives.filter(word => lowerText.includes(word));
  if (foundSuperlatives.length > 0) {
    console.log(`WasBedeutetDas: Superlative: ${foundSuperlatives.join(', ')}`);
    return false;
  }

  return true;
}
