/**
 * STRUCTURED CONTENT GENERATOR v2
 * 
 * Generates complete article structure in ONE LLM call:
 * - Headline
 * - Meta Description
 * - Lead (Intro)
 * - Content sections with H2 headings
 * - Q&A pairs
 * 
 * Output: Clean Markdown with proper ## headings
 */

/**
 * Replace em/en-dashes with natural punctuation.
 * Moved to lib/strip-dashes.ts so it can be shared with headline-engine and intro-engine.
 */
import { stripDashes, stripDashesDeep } from './strip-dashes';


/**
 * Detect if a headline is likely in English rather than German.
 * Uses common English words that wouldn't appear in German headlines.
 */
function isLikelyEnglish(text: string): boolean {
  const lower = text.toLowerCase();
  // Common English words that rarely appear in German
  const englishIndicators = [
    /\bthe\b/, /\bhits\b/, /\bnew\b/, /\breturns?\b/, /\bstrong\b/,
    /\bseason\b/, /\bshow\b/, /\breveal(s|ed)?\b/, /\brenew(s|ed)?\b/,
    /\bcancel(s|ed|led)?\b/, /\bfirst\b/, /\blook\b/, /\bwhat\b/,
    /\bwhy\b/, /\bhow\b/, /\bgets?\b/, /\brating(s)?\b/,
    /\btrailer\b/, /\brelease\b/, /\bupdate\b/, /\bfinally\b/,
    /\bconfirm(s|ed)?\b/, /\bannounce[ds]?\b/, /\bwatch\b/,
    /\bcoming\b/, /\beverything\b/, /\bknow\b/, /\bbest\b/,
    /\bworst\b/, /\bbiggest\b/, /\bhigh\b/, /\bhigher\b/,
  ];
  // German indicators - if present, it's probably German
  const germanIndicators = [
    /\bder\b/, /\bdie\b/, /\bdas\b/, /\bein(e)?\b/, /\bund\b/,
    /\bfür\b/, /\bmit\b/, /\bvon\b/, /\bnach\b/, /\bneu(e|es|er|en)?\b/,
    /\bstaffel\b/, /\bserie\b/, /\bfolge\b/, /\bkehrt\b/,
    /\bwird\b/, /\bhat\b/, /\bist\b/, /\bsind\b/, /\bwurde\b/,
    /\büberraschend\b/, /\bendlich\b/, /\berstmals\b/, /ä|ö|ü|ß/,
  ];
  
  let englishScore = 0;
  let germanScore = 0;
  
  for (const pattern of englishIndicators) {
    if (pattern.test(lower)) englishScore++;
  }
  for (const pattern of germanIndicators) {
    if (pattern.test(lower)) germanScore++;
  }
  
  // If more English indicators than German, it's likely English
  return englishScore >= 2 && englishScore > germanScore;
}

interface StructuredContentInput {
  facts: any; // ExtractedFacts object from fact-extractor
  seriesName: string;
  originalHeadline: string;
  sourceText: string;
  contentType: 'NEWS' | 'ENDING_EXPLAINED' | 'RANKING' | 'TRUE_STORY';
  wordCountTarget?: number;
  temperature?: number;
  /** Optional source URL — used by ENDING_EXPLAINED to parse season/episode. */
  sourceUrl?: string;
  /**
   * TRUE_STORY-Sicherheitsgrad. Bestimmt welches Pflicht-Headline-Pattern
   * angewandt wird: 'confirmed' → "Die wahre Geschichte hinter X. Wie ging
   * es weiter?", 'uncertain' → "Basiert X auf einer wahren Geschichte? Wie
   * ging es weiter?". Nur relevant wenn contentType === 'TRUE_STORY'.
   */
  trueStoryCertainty?: 'confirmed' | 'uncertain';
  /**
   * DACH-Lokalisierungs-Kontext (Phase B Feb 2026). Enthält:
   *  - dachStreamers: konkrete DACH-Streamer aus TMDB /watch/providers (region=DE)
   *  - dachExpectation: Fallback-Mapping bei leerer TMDB-Antwort ("CBS → Paramount+ erwartet")
   *  - originalNetworks: Original-US/UK-Sender (Produktions-Heimat, nur als Hintergrund)
   * Wenn nichts davon bekannt: Generator schreibt "Deutsche Ausstrahlung steht aus".
   */
  dachContext?: {
    dachStreamers: string[];
    dachExpectation: string | null;
    originalNetworks: string[];
  };
}

interface ContentSection {
  h2: string;
  paragraphs: string[];
}

interface StructuredContentOutput {
  headline: string;
  metaDescription: string;
  lead: string;
  sections: ContentSection[];
  qa: Array<{ question: string; answer: string }>;
  
  // Generated markdown (assembled from sections)
  markdown: string;
}

/**
 * Generate structured content with H2s built-in
 */
export async function generateStructuredContent(
  input: StructuredContentInput
): Promise<StructuredContentOutput> {
  const { facts, seriesName, originalHeadline, contentType, wordCountTarget = 400, temperature } = input;
  
  console.log('📝 Generating structured content...');
  console.log(`   Series: ${seriesName}`);
  console.log(`   Type: ${contentType}`);
  console.log(`   Target: ${wordCountTarget} words`);
  if (temperature !== undefined) console.log(`   Temperature: ${temperature}`);
  
  // Build prompt based on content type
  const prompt = buildPrompt(input);
  
  // Call LLM with structured output
  const response = await callLLMStructured(prompt, 2, temperature);

  // POST-PROCESS: strip em/en-dashes (AI-tells). Replace with natural punctuation.
  // But protect dashes that are part of the series name (e.g. "Verbotene Liebe – Next Generation").
  const protectedNames = [input.seriesName].filter((n): n is string => Boolean(n));
  stripDashesDeep(response, protectedNames);

  // Validate and assemble
  const output = assembleMarkdown(response);

  // ENDING_EXPLAINED: headline format is mandatory — enforce mechanically.
  if (input.contentType === 'ENDING_EXPLAINED' && output.headline) {
    const { enforceEndeErklaertFormat, parseEndingExplainedMetaFromUrl } = await import('./ende-erklaert-format');
    // Use URL-derived meta if the caller can supply it; fall back to null.
    const urlMeta = parseEndingExplainedMetaFromUrl((input as any).sourceUrl || '');
    const before = output.headline;
    output.headline = enforceEndeErklaertFormat({
      headline: output.headline,
      seriesTitle: input.seriesName,
      episodeType: urlMeta.episodeType,
      seasonNumber: urlMeta.seasonNumber,
      episodeNumber: urlMeta.episodeNumber,
    });
    if (before !== output.headline) {
      console.log(`   📐 Ende-erklärt Headline-Format korrigiert`);
      console.log(`      alt: "${before}"`);
      console.log(`      neu: "${output.headline}"`);
    }
  }

  // TRUE_STORY: headline format is mandatory — eines von zwei Pflicht-Pattern.
  if (input.contentType === 'TRUE_STORY' && output.headline) {
    const { enforceTrueStoryFormat } = await import('./true-story-format');
    const certainty = input.trueStoryCertainty || 'uncertain';
    const before = output.headline;
    output.headline = enforceTrueStoryFormat({
      headline: output.headline,
      seriesTitle: input.seriesName,
      certainty,
    });
    if (before !== output.headline) {
      console.log(`   📐 True-Story Headline-Format korrigiert (${certainty})`);
      console.log(`      alt: "${before}"`);
      console.log(`      neu: "${output.headline}"`);
    }
  }

  // Note: Headline wird durch Headline Engine in pipeline-v2 ersetzt.
  // Die Arbeits-Headline hier dient nur als Fallback.
  
  console.log(`   ✅ Generated: ${output.sections.length} sections, ${output.qa.length} Q&A`);
  
  return output;
}

/**
 * Build prompt based on content type
 */
function buildPrompt(input: StructuredContentInput): string {
  const { facts, seriesName, originalHeadline, contentType, wordCountTarget, sourceText, dachContext } = input;

  // ENDING_EXPLAINED has its own prompt: spoiler-warning + recap + interpretation.
  // Headline format is mandatory — "Das Ende von <Serie> <Unit> erklärt: …".
  if (contentType === 'ENDING_EXPLAINED') {
    const today = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'long', year: 'numeric' });
    const sourceExcerpt = (sourceText || '').slice(0, 6000);
    return `Schreibe einen deutschen "Ende erklärt"-Artikel für serien.de über "${seriesName}".

Heutiges Datum: ${today}
Serie: ${seriesName}
Quell-Headline (EN): ${originalHeadline}

ENGLISCHER RECAP (Quelle zur Orientierung — NICHT wörtlich übersetzen):
${sourceExcerpt}

═══════════════════════════════════════════════════════════════════════
PFLICHT-HEADLINE-FORMAT (KEINE AUSNAHME):
═══════════════════════════════════════════════════════════════════════
"headline" MUSS **EXAKT** beginnen mit:
  "Das Ende von ${seriesName} <Staffel N | Episode N | Film> erklärt:"
gefolgt von einem kurzen, konkreten Nachsatz (max. 8–10 Wörter).

Beispiele:
- "Das Ende von ${seriesName} Staffel 4 erklärt: Was Mars' letzter Blick bedeutet"
- "Das Ende von ${seriesName} Episode 10 erklärt: Darum bleibt die Tür offen"
- "Das Ende von ${seriesName} Film erklärt: Warum Ellie zurücklässt, was sie liebt"

Nutze "Staffel N" bei Staffelfinales, "Episode N" bei Einzelfolgen, "Film" bei Standalone.

═══════════════════════════════════════════════════════════════════════
STRUKTUR (JSON-Schema):
═══════════════════════════════════════════════════════════════════════
1. headline: siehe Pflicht-Format oben.
2. metaDescription: max 155 Zeichen. Enthält Serie + Hinweis, dass das Ende erklärt wird. Deutsch.
3. lead: EXAKT 3 Sätze, startet mit einer **klaren Spoiler-Warnung** ("Achtung, Spoiler: Wer ${seriesName} noch nicht gesehen hat, sollte hier aufhören.")
   Satz 2: Was passiert konkret am Ende (1 Kernfakt).
   Satz 3: Worauf der Artikel Antworten gibt.
4. sections: ${Math.max(3, Math.min(Math.ceil((wordCountTarget || 700) / 180), 5))} H2-Sections à 2–3 Absätze.
   Empfohlene H2-Struktur (frei anpassbar, aber diese Themen abdecken):
   - "Was passiert im Finale von ${seriesName}?" — chronologische Zusammenfassung der Schlussszenen
   - "Die wichtigsten Wendepunkte" — 2–3 zentrale Plot-Twists + Bedeutung
   - "Was die letzte Szene bedeutet" — Interpretation offener Fragen
   - "Wie geht es weiter?" — Setup für nächste Staffel / Ausblick (falls Quelle erwähnt)
5. qa: 3–5 Q&A-Paare zu konkreten Zuschauer-Fragen ("Stirbt X?", "Was passiert mit Y?", "Kommt Staffel N?").

═══════════════════════════════════════════════════════════════════════
SPRACHE & STIL:
═══════════════════════════════════════════════════════════════════════
- ALLES auf Deutsch. Serientitel im englischen Original belassen, Charakter-Namen aus dem Quelltext übernehmen.
- Keine wörtliche Übersetzung — eigene Formulierungen, eigene Reihenfolge.
- Neutral-redaktioneller Ton, keine AI-Floskeln ("In diesem Artikel…", "Zusammenfassend…").
- Absätze 2–4 Sätze. Lesbar, flüssig.
- KEINE Behauptungen, die nicht im Quelltext stehen. Wenn unklar → weglassen.
- VERBOTEN: Gedankenstriche (— oder –). Nutze Doppelpunkt, Komma, Punkt.
- Wortziel: ${wordCountTarget || 700} Wörter im Fließtext (ohne Lead/FAQ).`;
  }

  // TRUE_STORY has its own prompt: realer Hintergrund + "Wo sind sie jetzt"-
  // Update. Headline-Format ist Pflicht — beide Patterns enforced mechanisch.
  if (contentType === 'TRUE_STORY') {
    const today = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'long', year: 'numeric' });
    const sourceExcerpt = (sourceText || '').slice(0, 6000);
    const certainty = input.trueStoryCertainty || 'uncertain';
    const headlineExample = certainty === 'confirmed'
      ? `"Die wahre Geschichte hinter ${seriesName}. Wie ging es weiter?"`
      : `"Basiert ${seriesName} auf einer wahren Geschichte? Wie ging es weiter?"`;
    return `Schreibe einen deutschen Artikel für serien.de über den realen Hintergrund von "${seriesName}" und was aus den beteiligten Personen wurde ("Wo sind sie jetzt?").

Heutiges Datum: ${today}
Serie: ${seriesName}
Quell-Headline (EN): ${originalHeadline}

ENGLISCHER QUELLTEXT (zur Faktenbasis — NICHT wörtlich übersetzen):
${sourceExcerpt}

═══════════════════════════════════════════════════════════════════════
PFLICHT-HEADLINE (KEINE AUSNAHME):
═══════════════════════════════════════════════════════════════════════
"headline" MUSS **EXAKT** lauten:
  ${headlineExample}

Kein Kreativ-Spielraum, kein Suffix, keine Variation. Der Wert wird vom
Server zur Sicherheit nochmal mechanisch erzwungen.

═══════════════════════════════════════════════════════════════════════
STRUKTUR (JSON-Schema):
═══════════════════════════════════════════════════════════════════════
1. headline: siehe Pflicht-Format oben.
2. metaDescription: max 155 Zeichen. ${certainty === 'confirmed'
    ? `Klare Aussage: "${seriesName}" basiert auf realen Ereignissen, der Artikel zeigt was wirklich geschah und wo die Beteiligten heute stehen.`
    : `Frage als Hook: ${seriesName} — wahre Geschichte oder reine Fiktion? Der Artikel ordnet ein und zeigt das Schicksal der Vorlage-Personen.`}
3. lead: EXAKT 3 Sätze.
   ${certainty === 'confirmed'
     ? `Satz 1 startet mit "${seriesName}" als reale Vorlage (kurze Verankerung der wahren Begebenheit, 1 Schlüsselfakt).
   Satz 2: Wer waren die echten Personen, was passierte ihnen?
   Satz 3: Worauf der Artikel jetzt Antwort gibt (heutiger Status, neueste Erkenntnisse).`
     : `Satz 1 spielt die Frage des Headlines konkret aus ("${seriesName}" — Realität oder Erfindung?).
   Satz 2: Was die offizielle Quellenlage ergibt (Buch, Skandal, Gerichtsakte, Wikipedia-Eintrag etc.).
   Satz 3: Wie real-life-Personen heute mit der Adaption umgehen / wo sie stehen.`}
4. sections: ${Math.max(3, Math.min(Math.ceil((wordCountTarget || 600) / 180), 4))} H2-Sections à 2–3 Absätze.
   Empfohlene H2-Struktur (bitte abdecken):
   - "Was wirklich passierte" — chronologische Rekonstruktion der echten Ereignisse aus dem Quelltext
   - "Die Personen hinter der Serie" — wer ist wer (echter Name → Charaktername)
   - "Wo sie heute stehen" — aktueller Status (Strafmaß, Wohnort, öffentliche Auftritte, Verschwiegenheit)
   - "Was die Serie auslässt oder verändert" — wenn der Quelltext Fiktion-vs-Realität-Abweichungen erwähnt
5. qa: 3–5 Q&A-Paare. Beispiele: "Ist X heute noch im Gefängnis?", "Hat Y die Serie kommentiert?", "Wo lebt Z heute?", "Stimmt Detail D wirklich?".

═══════════════════════════════════════════════════════════════════════
SPRACHE & STIL — TITEL NAH AM ORIGINAL HALTEN
═══════════════════════════════════════════════════════════════════════
- ALLES auf Deutsch. Serientitel + Personen-Eigennamen aus dem Quelltext im Original belassen.
- Keine wörtliche Satz-für-Satz-Übersetzung — eigene Reihenfolge, eigene Formulierungen.
- Neutral-redaktioneller Ton, keine Boulevard-Aufgeregtheit.
- Absätze 2–4 Sätze.
- KEINE Behauptungen, die nicht im Quelltext stehen. Bei Lücken offen sagen ("nicht überliefert", "öffentlich nicht kommuniziert").
- VERBOTEN: Gedankenstriche (— oder –). Nutze Doppelpunkt, Komma, Punkt.
- Wortziel: ${wordCountTarget || 600} Wörter im Fließtext (ohne Lead/FAQ).`;
  }

  // Convert facts object to flat list
  const factsList: string[] = [];

  if (facts.key_statements && facts.key_statements.length > 0) {
    factsList.push(...facts.key_statements);
  }
  if (facts.season_numbers && facts.season_numbers.length > 0) {
    factsList.push(`Staffeln/Seasons: ${facts.season_numbers.join(', ')}`);
  }
  if (facts.release_dates && facts.release_dates.length > 0) {
    factsList.push(`Release: ${facts.release_dates.join(', ')}`);
  }
  if (facts.networks_platforms && facts.networks_platforms.length > 0) {
    factsList.push(`Platforms: ${facts.networks_platforms.join(', ')}`);
  }
  if (facts.people_names && facts.people_names.length > 0) {
    factsList.push(`WICHTIGE PERSONEN/CHARAKTERE: ${facts.people_names.slice(0, 10).join(', ')}`);
  }
  if (facts.series_names && facts.series_names.length > 0) {
    factsList.push(`Serien: ${facts.series_names.join(', ')}`);
  }
  
  // Extract character names separately for emphasis
  const characterNames = facts.people_names && facts.people_names.length > 0 
    ? facts.people_names.slice(0, 10).join(', ')
    : '';
  
  const factsText = factsList.slice(0, 15).map((f, i) => `${i + 1}. ${f}`).join('\n') || '(Keine spezifischen Fakten extrahiert)';
  
  // Calculate sections needed
  const sectionsNeeded = Math.ceil(wordCountTarget / 150); // ~150 words per section
  const targetSections = Math.max(3, Math.min(sectionsNeeded, 5)); // 3-5 sections
  
  const today = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'long', year: 'numeric' });

  // ───────────────────────────────────────────────────────────────────
  // DACH-LOKALISIERUNG (Phase B Feb 2026)
  // Wir bauen einen expliziten DACH-Kontext-Block in den Prompt, damit
  // Claude den deutschen Streamer im Lead nennt — nicht den US-Sender.
  // ───────────────────────────────────────────────────────────────────
  let dachBlock = '';
  if (dachContext) {
    const lines: string[] = [];
    if (dachContext.dachStreamers.length > 0) {
      lines.push(`In Deutschland verfügbar bei: ${dachContext.dachStreamers.join(', ')}`);
      lines.push('→ Diesen Streamer im Lead-Absatz Satz 1 oder 2 NAMENTLICH nennen.');
    } else if (dachContext.dachExpectation) {
      lines.push(`DACH-Erwartung (kein hartes Datum): ${dachContext.dachExpectation}`);
      lines.push('→ Im Lead als Erwartung formulieren, NIEMALS als bestätigtes Datum: z.B. "in DACH traditionell bei …" oder "Deutsche Ausstrahlung wird bei … erwartet".');
    } else {
      lines.push('DACH-Verfügbarkeit: UNBEKANNT.');
      lines.push('→ Im Lead explizit schreiben: "Deutsche Ausstrahlung steht aus" oder "Startdatum für Deutschland steht noch aus".');
    }
    if (dachContext.originalNetworks.length > 0) {
      lines.push(`Produktions-Heimat (nur Hintergrund, NICHT als Empfangsempfehlung): ${dachContext.originalNetworks.join(', ')}`);
    }
    dachBlock = `

═══════════════════════════════════════════════════════════════════════
DACH-LOKALISIERUNG (PFLICHT FÜR DEUTSCHE LESER):
═══════════════════════════════════════════════════════════════════════
${lines.join('\n')}

═══════════════════════════════════════════════════════════════════════
US-VERPACKUNG ENTFERNEN — STRIKT VERBOTEN IN HEADLINE / LEAD / BODY:
═══════════════════════════════════════════════════════════════════════
Die Quell-Artikel kommen aus US-Trade-Press und enthalten US-spezifische
Verpackung um den Story-Kern. Übernimm den Kern (Plot, Cast, Wendung,
Renewal, Zitat), aber NICHT diese Verpackung:

  ❌ US-/UK-Sender als Empfangs-Quelle:
     "auf ABC", "bei NBC", "läuft bei CBS", "FOX-Drama", "The CW",
     "BBC One", "BBC iPlayer", "Hulu", "Peacock", "HBO", "AMC",
     "Showtime", "Starz", "USA Network", "Syfy", "TNT"
     → WEGLASSEN. Sender nicht erwähnen, außer parallel als
       Produktions-Hintergrund mit DACH-Streamer ("die Serie wird in
       Deutschland bei Disney+ gestreamt; produziert wurde sie für ABC").

  ❌ US-Sendeplatz-Slang:
     "Primetime", "Tuesday primetime", "Donnerstagabend-Slot",
     "Sweeps Week", "Upfronts", "May Sweeps", "Fall premiere",
     "Midseason replacement", "Lead-out", "Lead-in", "ratings darling"
     → WEGLASSEN. Stattdessen schlicht: "in der ersten Staffel",
       "zum Auftakt", "zum Finale", "im Frühjahr 2026".

  ❌ US-Quoten:
     "X Millionen US-Zuschauer", "Nielsen-Zahlen", "Nielsen-Quote",
     "X demo", "household rating", "X Mio total viewers",
     "ratings winner", "linearer Marktanteil"
     → WEGLASSEN. International beliebt = "ist ein Hit" oder
       "fand ein großes Publikum" — ohne konkrete US-Zahl.

  ❌ US-Dollar-Beträge:
     "300 Millionen Dollar", "$1.2 Milliarden", "$50M pro Folge"
     → IMMER in Euro umrechnen mit Wechselkurs ≈ 0,92 EUR/USD und auf
       runde Zahlen runden. Beispiele:
         "300 Millionen Dollar" → "rund 275 Millionen Euro"
         "50 Millionen Dollar"  → "rund 45 Millionen Euro"
         "1,2 Milliarden Dollar" → "rund 1,1 Milliarden Euro"
       Niemals beide Währungen nennen ("300 Mio Dollar bzw. 275 Mio Euro").

  ❌ US-Kalender-Slang:
     "Tuesday, May 5", "this Thursday", "midweek slot"
     → Stattdessen Monat oder Datum im DE-Format ("am 5. Mai 2026"
       oder "im Mai") — keine Wochentag-Slot-Angaben.

  ❌ US-Industrie-Insider-Begriffe ohne DACH-Pendant:
     "showrunner deal", "studio note", "first-look deal",
     "overall deal", "pickup", "pilot order"
     → Inhaltlich übersetzen ("die Serie wurde in Auftrag gegeben",
       "Studio bestellte einen Piloten") oder weglassen.

ERLAUBT bleiben:
  ✅ Plot- und Charakter-Beschreibungen (alles, was IN der Serie passiert)
  ✅ Cast-Namen, Showrunner-Namen, Regisseur-Namen
  ✅ Zitate aus Interviews (mit korrekter Attribution)
  ✅ Renewal/Cancellation/Premiere-Daten (in DE-Format)
  ✅ DACH-Streamer (Netflix, Disney+, Sky/WOW, Paramount+, Amazon Prime, Joyn, RTL+, Apple TV+, MagentaTV, ARD/ZDF/ARTE-Mediathek)
  ✅ Produktions-Land (USA/UK/Kanada/…) als Sachinformation, einmalig

`;
  }

  // ───────────────────────────────────────────────────────────────────
  // SOURCE-TEXT KONTEXT (Mai 2026)
  // Der vollständige Quelltext kommt jetzt als CONTEXT-Block in den Prompt
  // (vorher nur Bullet-Fakten → "templated" AI-Output). Wir markieren ihn
  // KLAR als Quelle zum Verstehen — explizit NICHT zum Übersetzen oder
  // Übernehmen. Boilerplate-Marker werden ausgeschlossen, damit Aggregator-
  // Quizze / AI-Summary-Widgets / Watch-Cards nicht in den DE-Artikel
  // rutschen (Discover-Killer-Pattern).
  // ───────────────────────────────────────────────────────────────────
  const sourceContextBlock = (sourceText && sourceText.trim().length > 200)
    ? `

═══════════════════════════════════════════════════════════════════════
QUELL-ARTIKEL (NUR KONTEXT — NIEMALS ÜBERSETZEN ODER ÜBERNEHMEN):
═══════════════════════════════════════════════════════════════════════
Du erhältst hier den vollständigen Quelltext. Nutze ihn ausschließlich, um
den Sachverhalt vollständig zu verstehen, Zitate korrekt zu attribuieren
und Lücken in den Bullet-Fakten zu schließen.

❌ NIEMALS 1:1 übersetzen.
❌ NIEMALS ganze Absätze ins Deutsche spiegeln.
❌ Wenn der Quelltext einen Quiz-/Boilerplate-/Aggregator-Block enthält
   (typische Marker: "Generate a summary", "Try something different",
   "Show me the facts", "Explain it like", "You are a …", "You thrive in",
   "You carry the weight", "You build loyalty", "Like Follow Share",
   "Release Date", "Where to watch", "TV-MA", "Cast See All",
   "By <Autor> Published" + Byline-Bio, "image via …", interaktive Polls,
   "Which … are you?"-Quizze, "What To Watch"-Listicles am Artikelende) —
   diesen Block KOMPLETT IGNORIEREN. Niemals 2nd-Person ("Du bist", "Du
   gedeiht", "Du passt") in den deutschen Artikel übernehmen.
❌ Listen am Artikel-Ende ("Related stories", "Trending now") IGNORIEREN.
✅ Story-Kern (Wer/Was/Wo/Wann/Warum) verstehen.
✅ 1–2 direkte Zitate aus dem Quelltext einbauen, korrekt attribuiert
   ("Showrunner X erklärte gegenüber Variety: …").
✅ Konkrete Details (Zahlen, Daten, Namen) übernehmen, in eigene Worte
   gefasst und auf Deutsch geschrieben.

QUELLTEXT:
"""
${sourceText.trim().slice(0, 18000)}
"""
`
    : '';

  // ───────────────────────────────────────────────────────────────────
  // ANTI-AI-STIL-HÄRTUNG (Mai 2026)
  // Discover-Penalty-Schutz: zwingt eigenständige journalistische Stimme
  // statt Listicle-/Template-Pattern, das KI-Detektoren sofort erkennen.
  // ───────────────────────────────────────────────────────────────────
  const antiAiBlock = `

═══════════════════════════════════════════════════════════════════════
EIGENSTÄNDIGE JOURNALISTISCHE STIMME (PFLICHT):
═══════════════════════════════════════════════════════════════════════
Du schreibst einen EIGENSTÄNDIGEN deutschen Artikel — keinen Übersetzungs-
oder Aggregator-Text. Folgende Stil-Regeln sind verbindlich:

✅ Satz-Varianz (Burstiness): Wechsle Kurzsätze (4–8 Wörter) mit längeren
   Sätzen (15–25 Wörter). Vermeide gleichlange Reihen.
✅ Konkret statt abstrakt: "Tommy Norris jagt Bohrlecks in West Texas"
   statt "Der Protagonist navigiert Konflikte in einem rauen Umfeld".
✅ Aktive Sprache: "Sheridan kündigt …" statt "Es wurde angekündigt, dass".
✅ Eine direkte Quote oder ein konkretes Detail pro Section H2.
✅ Eigener Aufhänger im Lead, NICHT die Quell-Headline paraphrasiert.

❌ KEINE AI-Floskeln:
   "In diesem Artikel", "Zusammenfassend", "Es ist wichtig zu erwähnen",
   "Lass uns einen Blick werfen", "Bekanntlich", "Wie bereits erwähnt",
   "Ohne Zweifel", "In der heutigen Zeit", "Im Wesentlichen", "Letztendlich".

❌ KEINE Listicle-Pattern:
   "Hier sind 5 Gründe", "Top 3", "Das musst du wissen über",
   "Alles was du wissen musst", "Schritt 1: … Schritt 2: …".

❌ KEINE generischen Bewertungs-Floskeln:
   "ein wahres Highlight", "ein Meisterwerk", "absolut sehenswert",
   "unbedingt anschauen", "Pflichtprogramm", "die beste Serie aller Zeiten",
   "Fans sind begeistert" (nur wenn konkret belegt mit Zahl oder Quote).

❌ KEINE 2nd-Person-Anrede ("Du", "Du bist", "Du fühlst", "Stell dir vor")
   — schreibe distanziert-journalistisch in 3. Person.

❌ KEIN Plot-Recap, der nicht direkt zum News-Aufhänger gehört.

`;

  const basePrompt = `Schreibe einen strukturierten Artikel über "${originalHeadline}" für serien.de.
${sourceContextBlock}${antiAiBlock}
Heutiges Datum: ${today}
Serie: ${seriesName}
Fakten: ${factsText}
${characterNames ? `Charaktere (MÜSSEN verwendet werden): ${characterNames}` : ''}
${dachBlock}
WICHTIG: Alle Datumsangaben müssen korrekt sein. Heute ist ${today}. Schreibe KEINE vergangenen Jahre als Zukunft. Wenn keine konkreten Termine bekannt sind, schreibe "ein Startdatum steht noch aus" statt ein Jahr zu raten.

SPRACHE: ALLES auf DEUTSCH - ohne Ausnahme!
- Die Headline MUSS auf Deutsch sein. Übersetze englische Quell-Headlines komplett ins Deutsche.
- Die metaDescription MUSS auf Deutsch sein.
- Der Lead MUSS auf Deutsch sein.
- Alle H2-Überschriften MÜSSEN auf Deutsch sein.
- Der gesamte Fließtext MUSS auf Deutsch sein.
- Alle Q&A-Fragen und Antworten MÜSSEN auf Deutsch sein.
- KEIN einziges englisches Wort im gesamten Output (Ausnahme: Seriennamen, Eigennamen wie "Netflix", "Disney+").
- Übersetze ALLE englischen Begriffe: "ratings" → "Quoten/Einschaltquoten", "hits new high" → "erreicht neuen Höchststand", "returns" → "kehrt zurück", "season" → "Staffel", "renewed" → "verlängert", etc.

Struktur:
1. headline: Erzeuge eine KURZE Arbeits-Headline auf Deutsch (wird später durch Headline Engine ersetzt). Max 70 Zeichen, ideal 40–65. Auf Deutsch.
   WINNING-HEADLINE-REGELN (pflicht):
   - Starte mit Name, Zahl oder starkem Verb — NICHT mit "Die", "Der", "Das", "In", "Auf", "Nach".
   - Nutze ein starkes Handlungs-Verb: kippt, streicht, verlässt, enthüllt, überrascht, feuert, verliert, triumphiert. Kein "ist/hat/gibt/kommt".
   - Wenn möglich: Open Loop ("Warum…", "Darum…", "Was hinter…", "Deshalb…") oder konkrete Emotion (Abschied, Rückkehr, Krise, Schock, Wende).
   - VERBOTEN: "offiziell bestätigt", "im Überblick", "alles was ihr wissen müsst", "verständlich erklärt".
   - KEIN Label-Titel ("Serie: Staffel X bestätigt") — schreibe einen Aussagesatz.
2. metaDescription: Max 155 Zeichen, fasst den Kern des Artikels zusammen. Enthält den Seriennamen und den wichtigsten Fakt. Auf Deutsch.
3. lead: EXAKT 3 Sätze. Der Lead MUSS die Headline-Logik fortsetzen — nicht wiederholen, sondern weitertragen.

LEAD-REGELN (STRIKT):
- Wenn die Headline einen Konflikt enthält → Satz 1 beschreibt die Konsequenz
- Wenn die Headline eine Überraschung enthält → Satz 1 bestätigt und erweitert sie
- Wenn die Headline eine Veränderung enthält → Satz 1 erklärt was sich konkret ändert

Satz 1: Konsequenz / Bruch / Auswirkung (WAS passiert jetzt konkret?)
Satz 2: Fakten (Wer, Wo, Wann — Cast, Produktion, Plattform)
Satz 3: Warum das für die Story oder das Publikum relevant ist

VERBOTEN im Lead:
- NICHT mit einer Quelle beginnen ("Paramount hat...", "Netflix gab bekannt...")
- NICHT mit einer Zeitangabe beginnen ("In Staffel 2...", "Am 15. Mai...")
- NICHT neutral/generisch beginnen ("Es gibt Neuigkeiten zu...")
- NICHT die Headline umformulieren
- Wenn der Lead auf JEDEN beliebigen Artikel passen würde → Lead ist zu generisch

4. content: ${targetSections} Sections mit H2 (max 6 Wörter, auf Deutsch) + je 2-3 Absätze (2-4 Sätze)
5. qa: 3-5 häufige Fragen mit kurzen Antworten. Auf Deutsch.

QUELLEN-REGEL (STRIKT):
- Schreibe so, als wäre serien.de die PRIMÄRE Nachrichtenquelle.
- NIEMALS einen Satz mit einer Quellenzuschreibung beginnen:
  VERBOTEN: "Paramount hat bekannt gegeben...", "Netflix gab bekannt...", "Laut Deadline...", "Wie berichtet wurde...", "Laut Bericht...", "Berichten zufolge...", "Ein Bericht von..."
- NIEMALS im ERSTEN Absatz eine Quelle nennen.
- Quellen dürfen optional SPÄTER im Artikel erwähnt werden (ab Absatz 2), aber nie als Satzanfang.
- STATTDESSEN: Starte immer mit dem Fakt selbst.
  GUT: "The Boys wird nach Staffel 5 abgesetzt."
  SCHLECHT: "Amazon hat bekannt gegeben, dass The Boys nach Staffel 5 abgesetzt wird."
  GUT: "Staffel 3 startet im Oktober auf Netflix."
  SCHLECHT: "Wie Netflix mitteilte, startet Staffel 3 im Oktober."

Stil: Sachlich, journalistisch. Konkrete Namen statt generische Bezeichnungen ("Robby untersucht" statt "Ein Arzt untersucht"). Deutsche Anführungszeichen: „..."
Übersetze ALLE englischen Wörter aus den Fakten ins Deutsche (z.B. "approximately" → "etwa", "officially" → "offiziell", "wrapped filming" → "Dreharbeiten abgeschlossen"). Kein einziges englisches Wort im Fließtext.
Zielgruppe sind DEUTSCHE Leser. Nenne KEINE klassischen US-Fernsehsender (ABC, NBC, CBS, Fox, The CW) als Empfangshinweis. Beziehe dich stattdessen auf Streaming-Plattformen (Netflix, Disney+, Amazon Prime Video, Sky/WOW, Hulu, Paramount+, Apple TV+ etc.) oder schreibe allgemein "beim jeweiligen Streaming-Anbieter". US-Sender dürfen nur als Produktionshintergrund erwähnt werden, nicht als Empfangsempfehlung.`;

  return basePrompt;
}

/**
 * Call LLM with structured output format
 */
/**
 * Sanitize a prompt for Claude safety retry.
 * Replaces violence/crime trigger words with neutral TV-narrative language.
 * Only used on the retry after a 403 safety block.
 */
function sanitizePromptForSafety(prompt: string): string {
  const replacements: [RegExp, string][] = [
    // English violence triggers → neutral TV-narrative terms
    [/\bkilled off\b/gi, 'aus der Serie herausgeschrieben'],
    [/\bis killed\b/gi, 'scheidet aus der Handlung'],
    [/\bwas killed\b/gi, 'schied aus der Handlung'],
    [/\bbeing killed\b/gi, 'aus der Handlung genommen'],
    [/\bgets killed\b/gi, 'scheidet aus'],
    [/\bmurdered?\b/gi, 'verstorben (Handlung)'],
    [/\bassassinated?\b/gi, 'verstorben (Handlung)'],
    [/\bexecution\b/gi, 'Tod (Handlung)'],
    [/\bshot (dead|to death)\b/gi, 'verstorben'],
    [/\bbrutal(ly)?\b/gi, 'dramatisch'],
    [/\bviolent(ly)?\b/gi, 'dramatisch'],
    [/\bsuicide\b/gi, 'Tod'],
    [/\btorture[ds]?\b/gi, 'bedrängt'],
    [/\bbloody\b/gi, 'dramatisch'],
    [/\bgore\b/gi, 'Dramatik'],
    // German triggers
    [/\bermordet\b/gi, 'verstorben'],
    [/\bMord\b/g, 'Todesfall (Handlung)'],
    [/\bMordes\b/g, 'Todesfalls'],
    [/\bSelbstmord\b/g, 'Tod'],
    [/\bhinrichten?\b/gi, 'sterben'],
    [/\bblutig(e|es|er|en)?\b/gi, 'dramatisch'],
    [/\bbrutal(e|es|er|en)?\b/gi, 'intensiv'],
    [/\bOpfer\b/g, 'Betroffene'],
  ];
  let out = prompt;
  for (const [from, to] of replacements) out = out.replace(from, to);
  return out;
}

/**
 * Journalistic system-prompt wrapper for safety retry.
 * Frames the task explicitly as editorial news summarization, not creative writing.
 */
const JOURNALIST_SYSTEM_PROMPT =
  'Du bist ein erfahrener deutscher TV-Journalist für serien.de. Deine Aufgabe: redaktionelle ZUSAMMENFASSUNGEN von bereits veröffentlichten Branchennachrichten und Seriennews (Staffelankündigungen, Cast-Änderungen, Handlungsdiskussionen, Absetzungen). Dies sind FAKTISCHE, ZUSAMMENFASSENDE Meldungen, KEINE fiktionalen Szenen, KEINE Gewaltdarstellung, KEINE grafischen Details. Behandle Handlungsereignisse ("Figur X scheidet aus") als sachliche TV-News, nicht als Dramatisierung. ALLE Ausgaben MÜSSEN auf Deutsch sein - Headline, Meta-Description, Lead, Fließtext, H2-Überschriften, Q&A. Schreibe als PRIMÄRE Nachrichtenquelle, NIEMALS mit Quellenzuschreibung beginnen. Starte immer direkt mit dem Fakt. Antworte NUR mit validem JSON (keine Markdown-Codeblöcke, kein umgebender Text). Verwende echte Umlaute (ä, ö, ü). Keine deutschen Anführungszeichen wie „ oder ". VERBOTEN: Gedankenstriche (— oder –) in Headlines und im Text - nutze stattdessen Doppelpunkt, Komma oder Punkt. Keine Aufzählungsstriche in Fließtexten. Schreibe in klarem, natürlichem Journalisten-Deutsch, nicht literarisch-ausschweifend.';

async function callLLMStructured(prompt: string, retries = 2, temperature?: number): Promise<any> {
  let lastError: Error | null = null;
  let useSanitized = false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { createLLMClient, LLM_CONFIG } = await import('./llm-config');
      const openai = createLLMClient();

      // On sanitized retry: use journalist framing + keyword-neutralized prompt
      const systemContent = useSanitized
        ? JOURNALIST_SYSTEM_PROMPT
        : 'Du bist ein deutscher TV-Artikel-Generator für serien.de. ALLE Ausgaben MÜSSEN auf Deutsch sein - Headline, Meta-Description, Lead, Fließtext, H2-Überschriften, Q&A. Auch wenn die Quell-Headline englisch ist, MUSS deine Headline auf Deutsch sein. Schreibe als PRIMÄRE Nachrichtenquelle - NIEMALS mit Quellenzuschreibung beginnen ("Laut...", "XY hat bekannt gegeben..."). Starte immer direkt mit dem Fakt. Antworte NUR mit validem JSON (keine Markdown-Codeblöcke, kein umgebender Text). Umlaute als ae/oe/ue schreiben ist NICHT nötig - verwende echte Umlaute (ä, ö, ü). Verwende KEINE deutschen Anführungszeichen wie „ oder " - nutze einfache Anführungszeichen oder schreibe ohne. VERBOTEN: Gedankenstriche (— oder –) in Headlines und im Text. Nutze stattdessen Doppelpunkt, Komma oder Punkt. Beispiel - FALSCH: "Niemand hatte Gina Gosian auf dem Feld erwartet — und sie liefert". RICHTIG: "Niemand hatte Gina Gosian auf dem Feld erwartet: Sie liefert trotzdem". Schreibe in klarem, natürlichem Journalisten-Deutsch.';
      const userPromptBody = useSanitized ? sanitizePromptForSafety(prompt) : prompt;
      if (useSanitized) {
        console.log(`   🧼 Sanitized retry: journalist-framing + neutralized violence keywords`);
      }

      const response = await openai.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          {
            role: 'user',
            content: userPromptBody + `

OUTPUT FORMAT (JSON):
{
  "headline": "string (max 70 chars)",
  "metaDescription": "string (max 155 chars)",
  "lead": "string (2-3 Sätze)",
  "sections": [
    {
      "h2": "string (max 6 Wörter)",
      "paragraphs": ["string", "string", "string"]
    }
  ],
  "qa": [
    {
      "question": "string",
      "answer": "string (2-3 Sätze)"
    }
  ]
}

Antworte NUR mit dem JSON, keine zusätzlichen Erklärungen.`,
        },
      ],
      temperature: temperature ?? 0.7,
      max_tokens: 8192,
    });

    let content = response.choices[0]?.message?.content || '{}';

    // Debug: log first 300 chars of response
    console.log(`   📋 Raw LLM response (first 300): ${content.substring(0, 300)}`);

    // SOFT-REFUSAL DETECTION: Claude sometimes returns a refusal in the
    // response body instead of a 403 error. Detect and trigger sanitize-retry.
    const head = content.slice(0, 200).toLowerCase();
    const softRefusal =
      /^(ich kann|ich werde|i cannot|i can'?t|i won'?t|i will not|sorry,?\s+i)/i.test(content.trim()) ||
      head.includes('kann keinen') ||
      head.includes('kann keine') ||
      head.includes('keinen artikel erstell') ||
      head.includes('keine inhalte erstell');
    if (softRefusal && !useSanitized) {
      console.log(`   ⚠️ Soft refusal detected — triggering sanitized retry`);
      throw new Error('CLAUDE_SOFT_REFUSAL: 403 access_denied (refusal in response body)');
    }

    // Use robust JSON parser
    const { parseJsonResponse } = await import('./json-utils');
    return parseJsonResponse(content);
    } catch (error: any) {
      lastError = error;
      const errorType = error.code || error.name || 'Unknown';
      const msg = error?.message || String(error);
      const isSafetyBlock = /403|access_denied|safety|content_policy|content policy|CLAUDE_SOFT_REFUSAL/i.test(msg);

      // On first safety block → retry with sanitized prompt + journalist framing
      if (isSafetyBlock && !useSanitized) {
        console.log(`   ⚠️ Claude safety-blocked — retrying with journalist framing + sanitized prompt`);
        useSanitized = true;
        attempt--; // don't consume retry budget; retry immediately with sanitized version
        continue;
      }
      // Already sanitized and still blocked → abort
      if (isSafetyBlock && useSanitized) {
        console.log(`   ⛔ Still safety-blocked after sanitization — aborting`);
        throw new Error(`CONTENT_SAFETY_BLOCK: ${msg.substring(0, 140)}`);
      }
      console.log(`   ⚠️ LLM attempt ${attempt}/${retries} failed: [${errorType}] ${error.message}`);

      if (attempt < retries) {
        const delay = attempt * 2000; // 2s, 4s
        console.log(`   ⏳ Retrying in ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  // All retries failed
  throw new Error(`LLM failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Assemble structured response into clean Markdown
 */
function assembleMarkdown(response: any): StructuredContentOutput {
  // Validate
  if (!response.headline || !response.sections || response.sections.length === 0) {
    throw new Error('Invalid LLM response: missing required fields');
  }

  // IMPORTANT: the `lead` paragraph is stored separately on the article
  // (`excerpt` field) and rendered above the content as a bold intro block.
  // We deliberately DO NOT prepend it to the markdown body. Prepending it
  // produced a duplicate-intro pattern (Excerpt above + Lead as first <p>
  // below) that the user repeatedly flagged. The article body now starts
  // straight with the first H2 — matching the legacy serien.de layout.
  let markdown = '';

  response.sections.forEach((section: ContentSection) => {
    // Add H2
    markdown += `## ${section.h2}\n\n`;

    // Add paragraphs
    section.paragraphs.forEach((p: string) => {
      markdown += `${p}\n\n`;
    });
  });

  return {
    headline: response.headline,
    metaDescription: response.metaDescription || '',
    lead: response.lead,
    sections: response.sections,
    qa: response.qa || [],
    markdown: markdown.trim(),
  };
}
