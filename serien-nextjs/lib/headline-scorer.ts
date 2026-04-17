/**
 * HEADLINE SCORER v1
 * 
 * Bewertet Headlines auf einer Skala von 0-100 für Google Discover CTR.
 * Kein LLM-Call — rein regelbasiert und deterministisch.
 * 
 * Gewichtung:
 * - Neugier-Score:      0-25
 * - Klarheit:           0-20
 * - Einzigartigkeit:    0-20
 * - Emotionaler Trigger: 0-15
 * - Keyword-Präsenz:    0-10
 * - Länge optimal:      0-10
 */

interface HeadlineScoreResult {
  total: number;
  breakdown: {
    curiosity: number;
    clarity: number;
    uniqueness: number;
    emotion: number;
    keyword: number;
    length: number;
  };
  penalties: string[];
}

// Generische Phrasen die SOFORT abgestraft werden
const GENERIC_PHRASES = [
  'sorgt für aufsehen',
  'fans dürfen sich freuen',
  'das solltest du wissen',
  'das musst du wissen',
  'alles was du wissen musst',
  'alles was wir wissen',
  'das erwartet uns',
  'das erwartet dich',
  'hier sind die details',
  'was wir bisher wissen',
  'es ist soweit',
  'es ist offiziell',
  'es wurde bekannt',
  'große neuigkeiten',
  'spannende neuigkeiten',
  'aufregende neuigkeiten',
  'große veränderungen',
  'wichtige neuigkeit',
  'es gibt neuigkeiten',
  'jetzt wird es spannend',
  'es wird ernst',
];

// Füllwörter die den Titel verwässern
const FILLER_WORDS = [
  'tatsächlich', 'wirklich', 'offenbar', 'anscheinend', 'möglicherweise',
  'eventuell', 'gewissermaßen', 'grundsätzlich', 'eigentlich', 'sozusagen',
  'quasi', 'irgendwie', 'durchaus', 'ziemlich', 'relativ',
];

// Trigger-Wörter die Neugier erzeugen
const CURIOSITY_TRIGGERS = [
  'warum', 'wieso', 'darum', 'deshalb', 'so', 'plötzlich', 'überraschend',
  'unerwartet', 'heimlich', 'versehentlich', 'erstmals', 'zum ersten mal',
  'nie zuvor', 'anders als erwartet', 'statt', 'trotz', 'obwohl',
  'entgegen', 'geheimnis', 'hintergrund', 'was steckt', 'was bedeutet',
];

// Emotionale Trigger
const EMOTION_TRIGGERS = [
  'schock', 'wut', 'tränen', 'gänsehaut', 'kontroverse', 'streit',
  'kritik', 'empörung', 'begeisterung', 'enttäuschung', 'hoffnung',
  'abschied', 'comeback', 'ende', 'letzt', 'final', 'letzte chance',
  'nie wieder', 'endgültig', 'dramatisch', 'bitter', 'emotional',
];

// Starke Verben die Handlung signalisieren
const STRONG_VERBS = [
  'enthüllt', 'verrät', 'bestätigt', 'bricht', 'zerstört', 'verändert',
  'stoppt', 'rettet', 'verlässt', 'kehrt zurück', 'übernimmt', 'ersetzt',
  'fordert', 'warnt', 'verteidigt', 'entschuldigt', 'gesteht', 'widerspricht',
  'droht', 'verspricht', 'überrascht', 'schockiert', 'beweist',
];

// Zahlen/Superlative die Konkretes versprechen
const CONCRETE_PATTERNS = [
  /\d+/, // Enthält Zahlen
  /erste[rnms]?/, /letzte[rnms]?/, /größte[rnms]?/, /beste[rnms]?/,
  /schlimmste[rnms]?/, /stärkste[rnms]?/, /meiste[rnms]?/,
  /nie zuvor/, /zum ersten mal/, /rekord/, /100\s*%/,
];

export function scoreHeadline(headline: string, seriesName: string, allVariants: string[] = []): HeadlineScoreResult {
  const lower = headline.toLowerCase();
  const penalties: string[] = [];
  
  // === NEUGIER (0-25) ===
  let curiosity = 0;
  
  // Trigger-Wörter
  const triggerCount = CURIOSITY_TRIGGERS.filter(t => lower.includes(t)).length;
  curiosity += Math.min(10, triggerCount * 5);
  
  // Enthält Doppelpunkt oder Gedankenstrich (erzeugt Spannung)
  if (headline.includes(':') || headline.includes('–') || headline.includes('—')) curiosity += 3;
  
  // Frage-Struktur (aber kein Clickbait)
  if (lower.startsWith('warum') || lower.startsWith('wieso') || lower.startsWith('was ')) curiosity += 5;
  
  // Kontrast/Überraschung ("statt", "trotz", "obwohl")
  if (/\b(statt|trotz|obwohl|aber|doch)\b/.test(lower)) curiosity += 4;
  
  // Informationslücke ("das steckt dahinter", "der wahre Grund")
  if (/dahinter|wahrer? grund|hintergrund|geheimnis/.test(lower)) curiosity += 3;
  
  curiosity = Math.min(25, curiosity);

  // === KLARHEIT (0-20) ===
  let clarity = 10; // Startwert
  
  // Füllwörter abziehen
  const fillerCount = FILLER_WORDS.filter(f => lower.includes(f)).length;
  clarity -= fillerCount * 3;
  
  // Enthält konkretes Subjekt (nicht nur "die Serie")
  if (lower.includes(seriesName.toLowerCase())) clarity += 5;
  
  // Starkes Verb vorhanden
  if (STRONG_VERBS.some(v => lower.includes(v))) clarity += 5;
  
  // Zu vage? Keine konkrete Info?
  const hasConcreteInfo = CONCRETE_PATTERNS.some(p => p.test(lower)) || STRONG_VERBS.some(v => lower.includes(v));
  if (!hasConcreteInfo) {
    clarity -= 3;
    penalties.push('Kein konkretes Element (Zahl, Verb, Fakt)');
  }
  
  clarity = Math.max(0, Math.min(20, clarity));

  // === EINZIGARTIGKEIT (0-20) ===
  let uniqueness = 15; // Startwert
  
  // Generische Phrasen
  const genericHit = GENERIC_PHRASES.find(g => lower.includes(g));
  if (genericHit) {
    uniqueness -= 15;
    penalties.push(`Generische Phrase: "${genericHit}"`);
  }
  
  // Vergleich mit anderen Varianten — gleiche Satzanfänge?
  if (allVariants.length > 1) {
    const myStart = lower.split(/\s+/).slice(0, 3).join(' ');
    const duplicateStarts = allVariants.filter(v => v.toLowerCase().startsWith(myStart)).length;
    if (duplicateStarts > 1) {
      uniqueness -= 5;
      penalties.push('Identischer Satzanfang wie andere Variante');
    }
  }
  
  // Beginnt mit Serienname (zu Standard)
  if (lower.startsWith(seriesName.toLowerCase())) {
    uniqueness -= 3;
  }
  
  uniqueness = Math.max(0, Math.min(20, uniqueness));

  // === EMOTIONALER TRIGGER (0-15) ===
  let emotion = 0;
  
  const emotionHits = EMOTION_TRIGGERS.filter(e => lower.includes(e)).length;
  emotion += Math.min(10, emotionHits * 5);
  
  // Ausrufezeichen (dezent erlaubt, max 1)
  if (headline.includes('!') && !headline.includes('!!')) emotion += 2;
  if (headline.includes('!!')) { emotion -= 3; penalties.push('Doppeltes Ausrufezeichen = Clickbait'); }
  
  // Personalisierung ("Fans", "Zuschauer")
  if (/\bfans?\b|\bzuschauer\b|\bpublikum\b/.test(lower)) emotion += 3;
  
  emotion = Math.max(0, Math.min(15, emotion));

  // === KEYWORD-PRÄSENZ (0-10) ===
  let keyword = 0;
  
  // Serienname vorhanden
  if (lower.includes(seriesName.toLowerCase())) keyword += 5;
  else { keyword = 0; penalties.push('Serienname fehlt!'); }
  
  // "Staffel" + Nummer
  if (/staffel\s*\d/.test(lower)) keyword += 3;
  
  // Relevantes Keyword (Netflix, Trailer, Start, etc.)
  if (/netflix|disney|amazon|trailer|start|premiere|finale|abgesetzt|verlängert/.test(lower)) keyword += 2;
  
  keyword = Math.min(10, keyword);

  // === LÄNGE (0-10) ===
  let length = 0;
  const charCount = headline.length;
  
  if (charCount >= 40 && charCount <= 65) length = 10; // Sweet spot
  else if (charCount >= 30 && charCount <= 70) length = 7;
  else if (charCount >= 20 && charCount <= 80) length = 4;
  else { length = 0; penalties.push(`Länge ${charCount} Zeichen — außerhalb 40-65`); }

  // === TOTAL ===
  const total = curiosity + clarity + uniqueness + emotion + keyword + length;

  return {
    total: Math.max(0, Math.min(100, total)),
    breakdown: { curiosity, clarity, uniqueness, emotion, keyword, length },
    penalties,
  };
}
