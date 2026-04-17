/**
 * HEADLINE PATTERN LIBRARY v1
 * 
 * 24 geprüfte High-CTR Patterns für Google Discover.
 * Jedes Pattern hat Variablen: {Serie}, {Ereignis}, {Konflikt}, {Überraschung}
 * 
 * Die Headline Engine MUSS eines dieser Patterns als Vorlage nutzen.
 */

export interface HeadlinePattern {
  id: string;
  category: 'surprise' | 'twist' | 'curiosity' | 'conflict' | 'impact' | 'reaction';
  template: string;
  variables: string[];
  ctrBoost: number; // Bonus-Punkte im Scorer
}

export const HEADLINE_PATTERNS: HeadlinePattern[] = [
  // === KATEGORIE A: Überraschung ===
  {
    id: 'surprise_01',
    category: 'surprise',
    template: 'Mit {Ereignis} hat niemand gerechnet – {Serie} überrascht',
    variables: ['Ereignis', 'Serie'],
    ctrBoost: 15,
  },
  {
    id: 'surprise_02',
    category: 'surprise',
    template: 'Plötzlich passiert es: {Serie} geht einen unerwarteten Schritt',
    variables: ['Serie'],
    ctrBoost: 15,
  },
  {
    id: 'surprise_03',
    category: 'surprise',
    template: '{Serie} macht plötzlich, womit keiner gerechnet hat',
    variables: ['Serie'],
    ctrBoost: 12,
  },
  {
    id: 'surprise_04',
    category: 'surprise',
    template: 'Niemand hat damit gerechnet: {Serie} überrascht mit {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 15,
  },

  // === KATEGORIE B: Unerwartete Wendung ===
  {
    id: 'twist_01',
    category: 'twist',
    template: 'Doch noch: {Serie} macht überraschend {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 12,
  },
  {
    id: 'twist_02',
    category: 'twist',
    template: 'Kommt jetzt alles anders? {Serie} überrascht mit {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 10,
  },
  {
    id: 'twist_03',
    category: 'twist',
    template: 'Gegen alle Erwartungen: {Serie} ändert plötzlich {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 12,
  },
  {
    id: 'twist_04',
    category: 'twist',
    template: 'Anders als gedacht: {Serie} überrascht mit {Überraschung}',
    variables: ['Serie', 'Überraschung'],
    ctrBoost: 10,
  },

  // === KATEGORIE C: Neugier / Auflösung ===
  {
    id: 'curiosity_01',
    category: 'curiosity',
    template: 'Was jetzt bei {Serie} passiert, überrascht selbst Fans',
    variables: ['Serie'],
    ctrBoost: 10,
  },
  {
    id: 'curiosity_02',
    category: 'curiosity',
    template: 'Das steckt wirklich hinter {Ereignis} bei {Serie}',
    variables: ['Ereignis', 'Serie'],
    ctrBoost: 10,
  },
  {
    id: 'curiosity_03',
    category: 'curiosity',
    template: 'Darum überrascht {Serie} jetzt mit {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 8,
  },
  {
    id: 'curiosity_04',
    category: 'curiosity',
    template: 'Was bei {Serie} wirklich passiert – und warum es überrascht',
    variables: ['Serie'],
    ctrBoost: 10,
  },

  // === KATEGORIE D: Konflikt ===
  {
    id: 'conflict_01',
    category: 'conflict',
    template: 'Trotz {Konflikt}: {Serie} trifft überraschende Entscheidung',
    variables: ['Konflikt', 'Serie'],
    ctrBoost: 12,
  },
  {
    id: 'conflict_02',
    category: 'conflict',
    template: '{Ereignis} bei {Serie} sorgt plötzlich für Diskussionen',
    variables: ['Ereignis', 'Serie'],
    ctrBoost: 8,
  },
  {
    id: 'conflict_03',
    category: 'conflict',
    template: 'Erst gefeiert, jetzt umstritten: {Serie} polarisiert mit {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 12,
  },
  {
    id: 'conflict_04',
    category: 'conflict',
    template: '{Serie} spaltet Fans – wegen {Konflikt}',
    variables: ['Serie', 'Konflikt'],
    ctrBoost: 10,
  },

  // === KATEGORIE E: Direkt + Impact ===
  {
    id: 'impact_01',
    category: 'impact',
    template: 'Jetzt bestätigt: {Serie} überrascht mit {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 8,
  },
  {
    id: 'impact_02',
    category: 'impact',
    template: 'Offiziell: {Serie} macht {Ereignis} – und überrascht damit',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 8,
  },
  {
    id: 'impact_03',
    category: 'impact',
    template: '{Serie} bestätigt überraschend {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 6,
  },
  {
    id: 'impact_04',
    category: 'impact',
    template: 'Endgültig: {Serie} entscheidet sich für {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 8,
  },

  // === KATEGORIE F: Reaktion ===
  {
    id: 'reaction_01',
    category: 'reaction',
    template: 'Fans reagieren überrascht: {Serie} macht {Ereignis}',
    variables: ['Serie', 'Ereignis'],
    ctrBoost: 8,
  },
  {
    id: 'reaction_02',
    category: 'reaction',
    template: '{Ereignis} bei {Serie} löst starke Reaktionen aus',
    variables: ['Ereignis', 'Serie'],
    ctrBoost: 6,
  },
  {
    id: 'reaction_03',
    category: 'reaction',
    template: 'So reagieren Fans auf {Ereignis} bei {Serie}',
    variables: ['Ereignis', 'Serie'],
    ctrBoost: 6,
  },
  {
    id: 'reaction_04',
    category: 'reaction',
    template: 'Nach {Ereignis}: {Serie}-Fans sind überrascht',
    variables: ['Ereignis', 'Serie'],
    ctrBoost: 8,
  },
];

/**
 * Gibt Patterns nach Kategorie gruppiert zurück
 */
export function getPatternsByCategory(): Record<string, HeadlinePattern[]> {
  const grouped: Record<string, HeadlinePattern[]> = {};
  for (const p of HEADLINE_PATTERNS) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  return grouped;
}

/**
 * Formatiert alle Patterns als Prompt-String für das LLM
 */
export function getPatternsForPrompt(seriesName: string): string {
  const byCategory = getPatternsByCategory();
  const lines: string[] = [];

  const categoryLabels: Record<string, string> = {
    surprise: 'Überraschung',
    twist: 'Unerwartete Wendung',
    curiosity: 'Neugier / Auflösung',
    conflict: 'Konflikt',
    impact: 'Direkt + Impact',
    reaction: 'Reaktion',
  };

  for (const [cat, patterns] of Object.entries(byCategory)) {
    lines.push(`\n${categoryLabels[cat] || cat}:`);
    for (const p of patterns) {
      const example = p.template.replace(/\{Serie\}/g, seriesName);
      lines.push(`  - "${example}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Prüft ob eine Headline einem der Patterns ähnelt (loose match).
 * Gibt den ctrBoost des besten Matches zurück, oder 0.
 */
export function matchPattern(headline: string): { matched: boolean; patternId: string | null; ctrBoost: number } {
  const lower = headline.toLowerCase();

  // CTR-Booster Wörter (direkt aus den Patterns)
  const boosterWords: [RegExp, number][] = [
    [/plötzlich/, 5],
    [/niemand hat damit gerechnet/, 8],
    [/doch noch/, 5],
    [/überrasch/, 5],
    [/anders als (gedacht|erwartet)/, 5],
    [/gegen alle erwartungen/, 5],
    [/kommt.*anders/, 4],
    [/keiner.*gerechnet/, 6],
    [/jetzt bestätigt/, 4],
    [/offiziell:/, 3],
    [/trotz/, 4],
    [/erst gefeiert/, 5],
    [/spaltet fans/, 4],
    [/endgültig/, 3],
  ];

  let totalBoost = 0;
  for (const [pattern, boost] of boosterWords) {
    if (pattern.test(lower)) totalBoost += boost;
  }

  // Cap at 15
  totalBoost = Math.min(15, totalBoost);

  return {
    matched: totalBoost > 0,
    patternId: null,
    ctrBoost: totalBoost,
  };
}
