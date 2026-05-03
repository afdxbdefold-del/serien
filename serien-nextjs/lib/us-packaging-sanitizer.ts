/**
 * US-PACKAGING SANITIZER (Phase B+ Feb 2026)
 *
 * Defensive Schicht: nach Content-Generation, vor DB-Speicherung.
 * Auch wenn der Content-Prompt Claude untersagt, US-Verpackung zu
 * übernehmen — der LLM patzt manchmal. Dieser Sanitizer säubert
 * Headline / Lead / Body deterministisch von US-Sender-Mentions,
 * Nielsen-Zahlen, Primetime-Slang und Wochentag-Slot-Angaben.
 *
 * Idempotent. Liefert das gesäuberte Stück Text + ein Report mit
 * Anzahl entfernter US-Phrasen pro Kategorie. Bei ≥2 Treffern im
 * Lead → Re-Generation-Trigger (Quality-Gate).
 */

export interface SanitizeReport {
  removedNetworkMentions: number;
  removedNielsen: number;
  removedPrimetime: number;
  removedWeekdaySlots: number;
  total: number;
}

/**
 * US-/UK-Sender, deren bloße Erwähnung im DACH-Content irreführend ist.
 * Beim Match wird die ganze Phrasen-Hülle entfernt:
 *   "auf ABC" / "bei CBS" / "auf NBC" / "bei der CW" / "auf BBC One"
 *   "ABC's hit drama" → "der Hit"
 *   "the FOX series" → "die Serie"
 */
const NETWORK_NAMES = '(?:ABC|NBC|CBS|FOX|The\\s+CW|CW|BBC\\s*(?:One|Two|Three|Four|iPlayer|America)?|Hulu|Peacock|HBO\\s*(?:Max)?|Max|AMC(?:\\+|\\s*Plus)?|Showtime|Starz|USA\\s*Network|Syfy|TNT|TBS|FXX?|FX|Fox\\s+(?:News|Sports)|ITV(?:X)?|Channel\\s*[45])';

const NETWORK_PHRASE_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  // Headline-start: "<Network> bestätigt/zeigt/sendet/kündigt …" — Sender als Subjekt.
  // Wir wandeln in unpersönliche Form: "<Network> bestätigt X" → "X bestätigt"
  // wäre falsch; sauberer ist passiv: "<Network> bestätigt Rückkehr" → "Rückkehr bestätigt"
  // Stattdessen einfach Sender raus, Verb bleibt mit Subjekt-Lücke. Cleanup-Pass
  // korrigiert die kosmetischen Reste.
  { re: new RegExp(`(?:^|[.!?]\\s+)${NETWORK_NAMES}\\s+(bestätigt|kündigt|verlängert|verlaengert|bestellt|streicht|setzt\\s+ab|gibt\\s+(?:bekannt|grünes\\s+Licht)|ordert|zeigt|sendet|strahlt\\s+aus|holt|verpflichtet|engagiert)`, 'gi'), replace: '$1' },
  // "auf/bei <Sender>"
  { re: new RegExp(`\\b(?:auf|bei|über|ueber)\\s+(?:dem\\s+)?(?:Sender\\s+)?${NETWORK_NAMES}\\b\\.?`, 'gi'), replace: '' },
  // "<Sender>'s hit/drama/comedy" + "the <Sender> series" + "<Sender>-Serie"
  { re: new RegExp(`\\b${NETWORK_NAMES}['']?s?\\s+(?:hit|smash|new|long-running|critically\\s+acclaimed)?\\s*(drama|comedy|thriller|crime\\s+drama|sitcom|series|show|procedural)\\b`, 'gi'), replace: 'die $1' },
  { re: new RegExp(`\\bthe\\s+${NETWORK_NAMES}\\s+(drama|comedy|thriller|series|show|procedural|sitcom)\\b`, 'gi'), replace: 'die $1' },
  // "(Die|die|der|Der) <Network>-(Drama|Serie|Show|...)" → "die <Drama|Serie|...>"
  { re: new RegExp(`\\b(Die|die|Der|der|Das|das)\\s+${NETWORK_NAMES}[\\s-](Drama|Comedy|Thriller|Serie|Show|Hit|Sitcom)\\b`, 'gi'), replace: '$1 $2' },
  // bare "<Network>-Drama / -Serie" am Satzanfang/-mitte ohne Artikel
  { re: new RegExp(`(?<![\\w-])${NETWORK_NAMES}[\\s-](Drama|Comedy|Thriller|Serie|Show|Hit|Sitcom)\\b`, 'gi'), replace: 'die $1' },
  // "läuft/sendet/wird ausgestrahlt auf <Sender>"
  { re: new RegExp(`\\b(?:läuft|laeuft|läuft\\s+ab|laeuft\\s+ab|sendet|wird\\s+(?:gesendet|ausgestrahlt|gezeigt|übertragen|uebertragen))\\s+(?:in\\s+den\\s+USA\\s+)?(?:auf|bei|über|ueber)\\s+${NETWORK_NAMES}\\b\\.?`, 'gi'), replace: '' },
  // "BBC iPlayer streamt" — Streamer-Verb mit Sender als Subjekt am Satzanfang
  { re: new RegExp(`(?:^|[.!?]\\s+)${NETWORK_NAMES}\\s+(streamt|zeigt|verfügbar|verfuegbar|abrufbar)`, 'gi'), replace: '$1' },
];

const NIELSEN_PATTERNS: RegExp[] = [
  // Approximatoren VOR der Zahl konsumieren — sonst bleiben "Knapp", "Über", "Fast" als Waisen.
  // Auch separable deutsche Verben wie "schalteten ... ein" / "stellten ... ein" / "liefen ... auf"
  // mit konsumieren, sonst bleibt Verb-Fragment ohne Subjekt zurück.
  /\b(?:knapp|über|ueber|fast(?:\s+schon)?|rund|etwa|ca\.?|circa|gut|nahezu|beinahe|gerade\s+mal|mehr\s+als|weniger\s+als|an\s+die|nur|bloß|bloss)?\s*\d+(?:[.,]\d+)?\s*(?:Mio\.?|Millionen?)\s*(?:US-?)?(?:Zuschauer|Zuschauerinnen|Zuschauer:innen)\s*(?:in\s+den\s+USA)?\s*(?:einschalteten?|sahen?|schauten?|verfolgten?|verzeichnete?n?|zog|zogen)?(?:\s+(?:schalteten|stellten|sahen|schauten)\s+(?:beim\s+\S+\s+)?(?:ein|zu|an))?/gi,
  /\b(?:Nielsen|nielsen)[\s-]?(?:Zahlen|Quote|Rating|Daten|Werten?)?\b/gi,
  /\b\d+(?:[.,]\d+)?\s*Mio\.?\s*total\s*viewers/gi,
  /\b(?:household\s*rating|adult\s*demo|18-49\s*demo|key\s*demo)/gi,
  /\b(?:linearer?\s*Marktanteil|Reichweite\s*von\s*\d+(?:[.,]\d+)?\s*Mio)/gi,
  /\bratings\s*(?:darling|winner|hit|champion|king|queen)\b/gi,
];

const PRIMETIME_SLANG_PATTERNS: RegExp[] = [
  /\b(?:US-)?[Pp]rimetime(?:-(?:Slot|Sendeplatz|Hit|Erfolg|Premiere))?\b/g,
  /\b(?:Sweeps[\s-]?Week|May[\s-]?Sweeps|November[\s-]?Sweeps|Sweeps)\b/gi,
  /\b[Uu]pfronts?\b/g,
  /\b[Mm]idseason[\s-]?(?:replacement|premiere|opener)\b/g,
  /\b(?:lead-?in|lead-?out)\b/gi,
  /\b(?:fall|spring|summer|winter)[\s-]?premiere\b/gi,
  /\b(?:network|cable|broadcast)\s+(?:darling|standout|favourite|favorite)\b/gi,
];

const WEEKDAY_SLOT_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  // "Tuesday, May 5" → "5. Mai"  (US-Format)
  { re: /\b(Mon(?:day)?|Tues(?:day)?|Wed(?:nesday)?|Thurs(?:day)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*,?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(\d{1,2})\b/gi, replace: '$2 $3' },
  // "am Dienstagabend / Donnerstag-Primetime" als Slot-Angabe
  { re: /\bam\s+(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)abend(?:-Slot|-Sendeplatz)?\b/gi, replace: '' },
  { re: /\b(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)[\s-](?:Primetime|Sendeplatz|Slot)\b/gi, replace: '' },
  // "this Tuesday / this Thursday"
  { re: /\bthis\s+(Mon(?:day)?|Tues(?:day)?|Wed(?:nesday)?|Thurs(?:day)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\b/gi, replace: 'in dieser Woche' },
];

/**
 * Cleanup: Waisen-Phrasen, doppelte Artikel, Mehrfach-Spaces.
 * Beispiele was wir reparieren:
 *   "kehrt zurück und läuft. ." → "kehrt zurück und läuft."  (eigentlich sollte
 *      die Phrase ganz weg, also auch dangling " und läuft" weg)
 *   "die die Serie" → "die Serie"
 *   "Rückkehr von The Rookie zur" → "Rückkehr von The Rookie"
 *   "in der zurück" → "zurück"
 *   "Knapp ." → "."
 */
function cleanupArtefacts(s: string): string {
  return s
    // 1. Doppelte Artikel/Pronomen ("die die" → "die")
    .replace(/\b(die|der|das|den|dem|des|Die|Der|Das|Den|Dem|Des)\s+\1\b/g, '$1')
    // 2. Leere Klammern
    .replace(/\(\s*\)/g, '')
    // 3. Waisen-Verben am Satzende ("und läuft.", "und sendet.") — Verb ohne Objekt
    .replace(/\s+(und|sowie|oder)\s+(?:läuft|laeuft|sendet|streamt|zeigt)\s*\./g, '.')
    // 4. Trailing dangling Präpositionen vor Satzzeichen
    .replace(/\s+(zur|zum|ab|am|im|in der|auf|bei|über|ueber)\s*([.!?,;])/g, '$2')
    // 5. Trailing dangling Präpositionen am Satzende ohne Punkt
    .replace(/\s+(zur|zum|ab|am|im|in der|auf|bei|über|ueber)\s*$/gm, '')
    // 6. Waisen-Approximator ohne folgende Zahl: "Knapp ." / "Knapp ,"
    .replace(/\b(knapp|über|ueber|fast(?:\s+schon)?|rund|etwa|ca\.?|circa|gut|nahezu|beinahe)\s+([.,;:!?])/gi, '$2')
    // 7. Waisen-Approximator am Satzende
    .replace(/\b(knapp|über|ueber|fast(?:\s+schon)?|rund|etwa|ca\.?|circa|gut|nahezu|beinahe)\s+$/gim, '')
    // 8. Mehrfach-Spaces
    .replace(/\s{2,}/g, ' ')
    // 9. Space vor Satzzeichen
    .replace(/\s+([,.;:!?])/g, '$1')
    // 10. Doppelte Satzzeichen "..", ",.", ".."
    .replace(/([,.;:!?])\s*\1+/g, '$1')
    // 11. Komma direkt vor Satzende: "kehrt zurück, ." → "kehrt zurück."
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .trim();
}

/**
 * Sanitize a single text fragment (Headline, Lead, Body-HTML excerpt).
 * Liefert gesäuberten String + Anzahl Treffer pro Kategorie.
 */
export function sanitizeUsPackaging(text: string): { clean: string; report: SanitizeReport } {
  if (!text) return { clean: text, report: { removedNetworkMentions: 0, removedNielsen: 0, removedPrimetime: 0, removedWeekdaySlots: 0, total: 0 } };

  const report: SanitizeReport = {
    removedNetworkMentions: 0,
    removedNielsen: 0,
    removedPrimetime: 0,
    removedWeekdaySlots: 0,
    total: 0,
  };

  let s = text;

  for (const { re, replace } of NETWORK_PHRASE_PATTERNS) {
    s = s.replace(re, (...args) => {
      report.removedNetworkMentions++;
      report.total++;
      // Wenn replacement Capture-Groups nutzt, müssen wir manuell ersetzen
      if (replace.includes('$')) {
        return replace.replace(/\$(\d+)/g, (_, idx) => args[Number(idx)] || '');
      }
      return replace;
    });
  }

  for (const re of NIELSEN_PATTERNS) {
    s = s.replace(re, () => {
      report.removedNielsen++;
      report.total++;
      return '';
    });
  }

  for (const re of PRIMETIME_SLANG_PATTERNS) {
    s = s.replace(re, () => {
      report.removedPrimetime++;
      report.total++;
      return '';
    });
  }

  for (const { re, replace } of WEEKDAY_SLOT_PATTERNS) {
    s = s.replace(re, (...args) => {
      report.removedWeekdaySlots++;
      report.total++;
      if (replace.includes('$')) {
        return replace.replace(/\$(\d+)/g, (_, idx) => args[Number(idx)] || '');
      }
      return replace;
    });
  }

  return { clean: cleanupArtefacts(s), report };
}

/**
 * Sanitize a complete article structure. Iteriert über alle Text-Felder
 * und aggregiert den Report. Body wird block-weise behandelt, damit das
 * HTML-Tag-Markup erhalten bleibt — wir säubern nur Text-Inhalte zwischen
 * den Tags.
 */
export interface ArticleTextFields {
  headline: string;
  metaDescription?: string;
  lead?: string;
  bodyHtml?: string;
}

export function sanitizeArticle(input: ArticleTextFields): { clean: ArticleTextFields; report: SanitizeReport; leadHits: number } {
  const overall: SanitizeReport = {
    removedNetworkMentions: 0,
    removedNielsen: 0,
    removedPrimetime: 0,
    removedWeekdaySlots: 0,
    total: 0,
  };

  const headline = sanitizeUsPackaging(input.headline);
  const metaDescription = input.metaDescription ? sanitizeUsPackaging(input.metaDescription) : null;
  const lead = input.lead ? sanitizeUsPackaging(input.lead) : null;
  const bodyHtml = input.bodyHtml ? sanitizeBody(input.bodyHtml) : null;

  for (const r of [headline.report, metaDescription?.report, lead?.report, bodyHtml?.report].filter(Boolean) as SanitizeReport[]) {
    overall.removedNetworkMentions += r.removedNetworkMentions;
    overall.removedNielsen += r.removedNielsen;
    overall.removedPrimetime += r.removedPrimetime;
    overall.removedWeekdaySlots += r.removedWeekdaySlots;
    overall.total += r.total;
  }

  return {
    clean: {
      headline: headline.clean,
      metaDescription: metaDescription?.clean ?? input.metaDescription,
      lead: lead?.clean ?? input.lead,
      bodyHtml: bodyHtml?.clean ?? input.bodyHtml,
    },
    report: overall,
    leadHits: lead?.report.total ?? 0,
  };
}

/**
 * Body-HTML säubern: alle Text-Knoten zwischen Tags durchlaufen, US-Phrasen
 * entfernen, Tags unverändert lassen. Naive Implementation reicht — wir
 * brauchen keinen vollen HTML-Parser, weil die Pipeline nur einen
 * begrenzten Satz von Tags produziert (h2, h3, p, ul/li, strong, em, a).
 */
function sanitizeBody(html: string): { clean: string; report: SanitizeReport } {
  const overall: SanitizeReport = {
    removedNetworkMentions: 0,
    removedNielsen: 0,
    removedPrimetime: 0,
    removedWeekdaySlots: 0,
    total: 0,
  };

  // Match: alles, was NICHT zwischen < und > steht.
  const clean = html.replace(/(>|^)([^<]+)(<|$)/g, (_, lead, text, tail) => {
    const r = sanitizeUsPackaging(text);
    overall.removedNetworkMentions += r.report.removedNetworkMentions;
    overall.removedNielsen += r.report.removedNielsen;
    overall.removedPrimetime += r.report.removedPrimetime;
    overall.removedWeekdaySlots += r.report.removedWeekdaySlots;
    overall.total += r.report.total;
    return `${lead}${r.clean}${tail}`;
  });

  return { clean, report: overall };
}
