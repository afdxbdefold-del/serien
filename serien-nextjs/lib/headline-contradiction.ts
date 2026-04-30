/**
 * Headline ↔ Body contradiction detector.
 *
 * Runs alongside the Discover-Gate scorer to catch cases where the
 * headline makes a clickbait claim that the article body actively
 * disproves. Example (real): a "Shifting Gears überrascht" headline
 * paired with a body that says the renewal "war erwartet worden".
 *
 * Strategy:
 *   - For each "claim" pattern in the headline, scan the body for any
 *     opposite "disclaimer" pattern.
 *   - Patterns are German first, with a few common English carry-overs
 *     because we sometimes pull facts from US trades.
 *   - Single match is enough — false positives are cheap (we just trigger
 *     a rewrite), false negatives let slop through.
 *
 * The function is pure / unit-testable.
 */
export interface ContradictionHit {
  contradicted: boolean;
  claim?: string;
  disclaimer?: string;
  reason?: string;
}

interface Rule {
  /** Identifier shown in logs / rewrite hints */
  label: string;
  /** Triggered if any of these match the headline (lower-case) */
  headline: RegExp[];
  /** Considered a contradiction if any of these match the body (lower-case) */
  body: RegExp[];
}

const RULES: Rule[] = [
  {
    label: 'Überraschung vs. erwartet',
    headline: [
      /(?<![a-zäöüß])(überraschend|überrascht|überraschung|unerwartet|verblüffend|sensationell|schockt?|schock)(?![a-zäöüß])/i,
      /(?<![a-zäöüß])plötzlich(e|er|es)?(?![a-zäöüß])/i,
    ],
    body: [
      /(?<![a-zäöüß])(erwartet|wenig\s+überraschend|nicht\s+überraschend|wie\s+(angekündigt|geplant|erwartet))(?![a-zäöüß])/i,
      /(?<![a-zäöüß])(seit\s+(monaten|wochen|langem)\s+(bekannt|klar|angekündigt))(?![a-zäöüß])/i,
      /(?<![a-zäöüß])(galt\s+als\s+sicher|war\s+absehbar|stand\s+(bereits\s+)?fest)(?![a-zäöüß])/i,
      /\b(was\s+long\s+expected|widely\s+expected|long\s+anticipated)\b/i,
    ],
  },
  {
    label: 'Neu vs. Wiederholung/Fortsetzung',
    headline: [/(?<![a-zäöüß])(brandneu|premiere|debüt|debut|erstmals)(?![a-zäöüß])/i],
    body: [
      /(?<![a-zäöüß])(wiederholung|reboot\s+der\s+wiederholung|bereits\s+veröffentlicht|läuft\s+seit\s+(jahren|monaten))(?![a-zäöüß])/i,
    ],
  },
  {
    label: 'Aus/Ende vs. verlängert',
    headline: [
      /(?<![a-zäöüß])(abgesetzt|gecancelt|cancelled|endgültig\s+aus|ende\s+nach|wird\s+eingestellt|gestrichen)(?![a-zäöüß])/i,
    ],
    body: [
      /(?<![a-zäöüß])(verlängert|verlängerung\s+(bestätigt|angekündigt)|geht\s+weiter|neue\s+staffel\s+(bestätigt|angekündigt))(?![a-zäöüß])/i,
    ],
  },
  {
    label: 'Rückkehr vs. nicht zurück',
    headline: [/(?<![a-zäöüß])(kehrt\s+zurück|comeback|rückkehr)(?![a-zäöüß])/i],
    body: [
      /(?<![a-zäöüß])(kehrt\s+nicht\s+zurück|kommt\s+nicht\s+zurück|wird\s+nicht\s+zurückkehren|nie\s+wieder\s+(dabei|teil))(?![a-zäöüß])/i,
    ],
  },
  {
    label: 'Bestätigt vs. unbestätigt',
    headline: [/(?<![a-zäöüß])(bestätigt|fix|offiziell)(?![a-zäöüß])/i],
    body: [
      /(?<![a-zäöüß])(noch\s+nicht\s+(bestätigt|offiziell)|gerücht(e|eweise)|berichten\s+von|angeblich|spekul(ation|iert))(?![a-zäöüß])/i,
    ],
  },
];

/**
 * @param headline article headline (any case)
 * @param body raw article body — markdown / plain text. We only inspect the first ~3500 chars.
 */
export function detectHeadlineContradiction(
  headline: string,
  body: string,
): ContradictionHit {
  const h = (headline || '').toLowerCase();
  const b = (body || '').slice(0, 3500).toLowerCase();
  if (!h || !b) return { contradicted: false };

  for (const rule of RULES) {
    const claimMatch = rule.headline.find((re) => re.test(h));
    if (!claimMatch) continue;
    const disclaimerMatch = rule.body.find((re) => re.test(b));
    if (!disclaimerMatch) continue;
    return {
      contradicted: true,
      claim: claimMatch.source,
      disclaimer: disclaimerMatch.source,
      reason: rule.label,
    };
  }
  return { contradicted: false };
}
