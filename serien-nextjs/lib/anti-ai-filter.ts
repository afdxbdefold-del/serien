/**
 * ANTI_AI_SMELL_FILTER v1.0
 * 
 * Prüft, ob Artikel wie von menschlichem Redakteur geschrieben wirkt
 * 
 * 6 Stufen:
 * 0) Hard Blocklist
 * 1) Sentence Structure
 * 2) Opening Humanity Test
 * 3) Fact → Context Separation
 * 4) Repetition Killer
 * 5) Human Variance Injection
 * 6) AI Detection Self-Check
 * 
 * Output: antiAiScore 0-100
 * PASS: ≥80, REWRITE: <80, DRAFT: <80 after rewrite
 */

const LLM_PROXY_URL = 'https://api.openai.com/v1/chat/completions';

interface AntiAiFilterInput {
  articleHtml: string;
  headline: string;
  seriesName: string;
  isRankingList?: boolean; // NEW: For RANKING_LIST override
}

interface AntiAiFilterResult {
  status: 'PASS' | 'FAIL';
  antiAiScore: number; // 0-100
  failReasons: string[];
  details: {
    hardBlocklist: { found: string[]; score: number };
    sentenceStructure: { issues: string[]; score: number };
    openingHumanity: { hasFact: boolean; hasEmotion: boolean; score: number };
    factContextSeparation: { proper: boolean; score: number };
    repetitionKiller: { repetitions: string[]; score: number };
    aiDetectionCheck: { verdict: 'KI' | 'Redakteur' | 'Unklar'; score: number };
  };
  needsRewrite: boolean;
}

// STEP 0: Hard Blocklist
const HARD_BLOCKLIST = [
  'Fans dürfen sich freuen',
  'Ein absolutes Highlight',
  'Endlich ist es soweit',
  'Die beliebte Serie',
  'Wie jetzt bekannt wurde',
  'Sorgt für Aufsehen',
  'Ein echter Erfolg',
  'Ein Meilenstein',
  'Was wir wissen',
  'Alles, was wir wissen',
];

export async function antiAiFilter(input: AntiAiFilterInput): Promise<AntiAiFilterResult> {
  const failReasons: string[] = [];
  
  // EMERGENT_RULESET_UPDATE: Lower threshold for RANKING_LIST
  const isRankingList = input.isRankingList || false;
  const passThreshold = isRankingList ? 75 : 80; // Lower for rankings
  
  const plainText = input.articleHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const paragraphs = input.articleHtml.match(/<p>(.*?)<\/p>/g) || [];
  const paragraphTexts = paragraphs.map(p => p.replace(/<\/?p>/g, '').trim());
  
  // STEP 0: Hard Blocklist
  const hardBlocklist = checkHardBlocklist(plainText, failReasons);
  
  // STEP 1: Sentence Structure
  const sentenceStructure = checkSentenceStructure(paragraphTexts, failReasons);
  
  // STEP 2: Opening Humanity Test
  const openingHumanity = checkOpeningHumanity(paragraphTexts, failReasons);
  
  // STEP 3: Fact → Context Separation
  const factContextSeparation = checkFactContextSeparation(paragraphTexts, failReasons);
  
  // STEP 4: Repetition Killer (skip for RANKING_LIST - naturally repetitive)
  const repetitionKiller = isRankingList 
    ? { repetitions: [], score: 100 } // Skip repetition check for rankings
    : checkRepetitions(paragraphTexts, input.seriesName, failReasons);
  
  // STEP 6: AI Detection Self-Check (async)
  const aiDetectionCheck = await checkAiDetection(plainText, input.headline);
  
  if (aiDetectionCheck.verdict === 'KI' && !isRankingList) {
    // For rankings, don't fail on AI detection alone
    failReasons.push('AI-Detection: Text klingt nach KI');
  }
  
  // Calculate total score
  const antiAiScore = 
    hardBlocklist.score * 0.25 +
    sentenceStructure.score * 0.15 +
    openingHumanity.score * 0.20 +
    factContextSeparation.score * 0.15 +
    repetitionKiller.score * (isRankingList ? 0.05 : 0.10) + // Less weight for rankings
    aiDetectionCheck.score * (isRankingList ? 0.20 : 0.15); // More weight on structure for rankings
  
  const passed = antiAiScore >= passThreshold;
  const needsRewrite = antiAiScore < passThreshold || hardBlocklist.found.length > 0;
  
  return {
    status: passed ? 'PASS' : 'FAIL',
    antiAiScore: Math.round(antiAiScore),
    failReasons,
    details: {
      hardBlocklist,
      sentenceStructure,
      openingHumanity,
      factContextSeparation,
      repetitionKiller,
      aiDetectionCheck,
    },
    needsRewrite,
  };
}

function checkHardBlocklist(text: string, failReasons: string[]) {
  const found: string[] = [];
  
  HARD_BLOCKLIST.forEach(phrase => {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      found.push(phrase);
      failReasons.push(`Hard Blocklist: "${phrase}"`);
    }
  });
  
  const score = found.length === 0 ? 100 : 0;
  
  return { found, score };
}

function checkSentenceStructure(paragraphs: string[], failReasons: string[]) {
  const issues: string[] = [];
  let score = 100;
  
  paragraphs.forEach((para, pIndex) => {
    const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Max 22 Wörter pro Satz
    sentences.forEach((sentence, sIndex) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 22) {
        issues.push(`Absatz ${pIndex + 1}, Satz ${sIndex + 1}: ${words} Wörter (max: 22)`);
        score -= 5;
      }
    });
    
    // Kein Absatz > 4 Sätze
    if (sentences.length > 4) {
      issues.push(`Absatz ${pIndex + 1}: ${sentences.length} Sätze (max: 4)`);
      failReasons.push(`Absatz ${pIndex + 1} zu lang (${sentences.length} Sätze)`);
      score -= 10;
    }
    
    // Keine 3 Sätze mit gleicher Struktur
    if (sentences.length >= 3) {
      const starts = sentences.map(s => s.trim().split(/\s+/)[0].toLowerCase());
      for (let i = 0; i <= starts.length - 3; i++) {
        if (starts[i] === starts[i + 1] && starts[i + 1] === starts[i + 2]) {
          issues.push(`Absatz ${pIndex + 1}: 3 Sätze beginnen mit "${starts[i]}"`);
          failReasons.push('Wiederholte Satzanfänge');
          score -= 15;
          break;
        }
      }
    }
  });
  
  return { issues, score: Math.max(0, Math.min(100, score)) };
}

function checkOpeningHumanity(paragraphs: string[], failReasons: string[]) {
  if (paragraphs.length === 0) {
    return { hasFact: false, hasEmotion: false, score: 0 };
  }
  
  const para1 = paragraphs[0].toLowerCase();
  
  // Check for concrete fact
  const factWords = ['bestätigt', 'angekündigt', 'startet', 'endet', 'erhält', 'veröffentlicht'];
  const hasFact = factWords.some(word => para1.includes(word));
  
  // Check for emotion (BAD)
  const emotionWords = ['freuen', 'begeistert', 'aufregend', 'spannend', 'emotional', 'dramatisch'];
  const hasEmotion = emotionWords.some(word => para1.includes(word));
  
  let score = 100;
  
  if (!hasFact) {
    failReasons.push('Absatz 1: Kein konkreter Fakt');
    score -= 50;
  }
  
  if (hasEmotion) {
    failReasons.push('Absatz 1: Emotion statt Fakt');
    score -= 50;
  }
  
  return { hasFact, hasEmotion, score: Math.max(0, score) };
}

function checkFactContextSeparation(paragraphs: string[], failReasons: string[]) {
  if (paragraphs.length < 3) {
    return { proper: true, score: 100 }; // Too short to check
  }
  
  const para1 = paragraphs[0].toLowerCase();
  
  // Check for opinion in first paragraph (BAD)
  const opinionWords = ['meiner meinung', 'ich denke', 'vermutlich', 'wahrscheinlich'];
  const hasOpinion = opinionWords.some(word => para1.includes(word));
  
  let score = 100;
  
  if (hasOpinion) {
    failReasons.push('Absatz 1: Meinung/Spekulation statt Fakt');
    score -= 50;
  }
  
  return { proper: !hasOpinion, score };
}

function checkRepetitions(paragraphs: string[], seriesName: string, failReasons: string[]) {
  const repetitions: string[] = [];
  let score = 100;
  
  paragraphs.forEach((para, pIndex) => {
    const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Check consecutive sentence starts
    for (let i = 0; i < sentences.length - 1; i++) {
      const start1 = sentences[i].trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      const start2 = sentences[i + 1].trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      
      if (start1 === start2 && start1.length > 5) {
        repetitions.push(`Absatz ${pIndex + 1}: "${start1}" wiederholt`);
        failReasons.push(`Wiederholter Satzanfang: "${start1}"`);
        score -= 15;
      }
    }
    
    // Check series name repetition (max 3x per paragraph)
    const seriesCount = (para.match(new RegExp(seriesName, 'gi')) || []).length;
    if (seriesCount > 3) {
      repetitions.push(`Absatz ${pIndex + 1}: "${seriesName}" ${seriesCount}x erwähnt`);
      score -= 10;
    }
  });
  
  return { repetitions, score: Math.max(0, Math.min(100, score)) };
}

async function checkAiDetection(text: string, headline: string): Promise<{ verdict: 'KI' | 'Redakteur' | 'Unklar'; score: number }> {
  const systemPrompt = `Du bist ein Experte für KI-generierte Texte.

AUFGABE: Bewerte, ob dieser deutsche TV-News-Artikel von einer KI oder einem menschlichen Redakteur geschrieben wurde.

KRITERIEN:
- KI: Generisch, zu perfekt, repetitiv, emotionslos, Füllwörter
- Redakteur: Natürlich, variabel, direkt, menschlich

Antworte NUR mit JSON:
{
  "verdict": "KI" | "Redakteur" | "Unklar",
  "confidence": 0.0-1.0,
  "reason": "Kurze Begründung"
}`;

  const userPrompt = `HEADLINE: ${headline || ''}

TEXT:
${(text || '').substring(0, 800)}

Bewerte: KI oder Redakteur?`;

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
        max_completion_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    const verdict = parsed.verdict;
    const score = verdict === 'Redakteur' ? 100 : verdict === 'Unklar' ? 50 : 0;

    return { verdict, score };

  } catch (error) {
    console.error('AI Detection check failed:', error);
    return { verdict: 'Unklar', score: 50 };
  }
}
