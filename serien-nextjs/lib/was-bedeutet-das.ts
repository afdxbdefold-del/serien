/**
 * WAS_BEDEUTET_DAS Generator
 * 
 * Erklärt in 1-2 nüchternen Sätzen die praktische Bedeutung einer News
 * Max 2 Sätze, max 35 Wörter, keine Emotion
 */

import { getLLMFetchConfig } from './llm-config';

const { url: LLM_PROXY_URL, headers: LLM_HEADERS, model: LLM_MODEL } = getLLMFetchConfig();

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
  const systemPrompt = `Erkläre in 1-2 sachlichen Sätzen die praktische Bedeutung dieser TV-Serien-News.

Max 35 Wörter, max 2 Sätze. Nüchtern, keine Emotion/Meinung/Spekulation.
Satz 1: Was ändert sich konkret? Satz 2 (optional): Einschränkung oder Kontext.

Nur den Text, kein JSON.`;

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
      headers: LLM_HEADERS,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_completion_tokens: 100,
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


// ============================================================
// DARUM IST DAS RELEVANT
// ============================================================

interface DarumRelevantInput {
  articleHtml: string;
  headline: string;
  seriesName: string;
  extractedFacts: string;
}

export async function generateDarumRelevant(
  input: DarumRelevantInput
): Promise<string | null> {
  try {
    const systemPrompt = `Erkläre in 1-2 sachlichen Sätzen, warum diese Serien-Nachricht für Zuschauer relevant ist.

Max 40 Wörter, max 2 Sätze. Nüchtern, faktisch. Keine Emotion, kein "Fans", kein Ausrufezeichen.
Erkläre den Kontext: Warum betrifft das den Zuschauer? (z.B. Wartezeit, Streaming-Verfügbarkeit, beliebte Besetzung)

Nur den Text, kein JSON, keine Anführungszeichen.`;

    const userPrompt = `HEADLINE: ${input.headline}
SERIE: ${input.seriesName}
FAKTEN: ${input.extractedFacts}

Warum ist das relevant? (max 2 Sätze, max 40 Wörter)`;

    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: LLM_HEADERS,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_completion_tokens: 120,
      }),
    });

    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

    const data = await response.json();
    const text = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');

    const wordCount = text.split(/\s+/).length;
    if (wordCount > 45 || text.includes('!')) return null;

    return text;
  } catch (error) {
    console.error('DarumRelevant generation failed:', error);
    return null;
  }
}

// ============================================================
// BISHERIGER STAND ZUR SERIE
// ============================================================

interface BisherigerStandInput {
  seriesName: string;
  seriesOverview: string | null;
  seriesStatus: string | null;
  seriesSeasons: any;
  headline: string;
  extractedFacts: string;
}

export async function generateBisherigerStand(
  input: BisherigerStandInput
): Promise<string | null> {
  try {
    const seasonInfo = input.seriesSeasons 
      ? (Array.isArray(input.seriesSeasons) ? `${input.seriesSeasons.length} Staffeln` : '')
      : '';

    const systemPrompt = `Fasse in 2-3 sachlichen Sätzen den bisherigen Stand einer TV-Serie zusammen.

Max 50 Wörter. Nüchtern, faktisch. Keine Meinung, kein "Fans", kein Ausrufezeichen.
Nenne: Wie viele Staffeln gibt es? Wo läuft die Serie? Was war der letzte Stand?

Nur den Text, kein JSON, keine Anführungszeichen.`;

    const userPrompt = `SERIE: ${input.seriesName}
STATUS: ${input.seriesStatus || 'unbekannt'}
STAFFELN: ${seasonInfo}
ÜBERBLICK: ${(input.seriesOverview || '').substring(0, 300)}
AKTUELLE NEWS: ${input.headline}
FAKTEN: ${input.extractedFacts}

Bisheriger Stand zur Serie (max 3 Sätze, max 50 Wörter)`;

    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: LLM_HEADERS,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_completion_tokens: 150,
      }),
    });

    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

    const data = await response.json();
    const text = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');

    const wordCount = text.split(/\s+/).length;
    if (wordCount > 60 || text.includes('!')) return null;

    return text;
  } catch (error) {
    console.error('BisherigerStand generation failed:', error);
    return null;
  }
}
