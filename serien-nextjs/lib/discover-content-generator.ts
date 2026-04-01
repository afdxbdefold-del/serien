import { parseJsonResponse } from './json-utils';
/**
 * Google Discover Content Generator
 * Generates evergreen, editorial content for Series Hub pages
 * Optimized for Google Discover & Search
 */

interface DiscoverContentInput {
  seriesName: string;
  overview: string;
  genres: string[];
  firstAirYear: number | null;
  numberOfSeasons: number | null;
  status: string | null;
  networks: string[];
  creators: string[];
  cast: any[];
}

interface DiscoverContent {
  evergreenIntro: string;
  seriesStatus: string;
  newsContext: string;
  miniQA: Array<{ question: string; answer: string }>;
}

/**
 * Generate all Discover-optimized content sections
 */
export async function generateDiscoverContent(
  input: DiscoverContentInput
): Promise<DiscoverContent> {
  const {
    seriesName,
    overview,
    genres,
    firstAirYear,
    numberOfSeasons,
    status,
    networks,
    creators,
    cast,
  } = input;

  // Build context
  const genreText = genres.length > 0 ? genres.join(', ') : 'Drama';
  const networkText = networks.length > 0 ? networks.join(', ') : 'unbekannt';
  const mainCast = cast.slice(0, 3).map(c => c.name).join(', ');
  const creatorText = creators.length > 0 ? creators.join(', ') : 'unbekannt';
  const yearText = firstAirYear ? `seit ${firstAirYear}` : '';
  const seasonsText = numberOfSeasons ? `${numberOfSeasons} Staffel${numberOfSeasons > 1 ? 'n' : ''}` : '';

  const prompt = `Du bist Redakteur für eine professionelle deutsche Entertainment-Website im Stil von Serienjunkies oder DWDL.

**AUFGABE**: Erstelle redaktionelle Evergreen-Inhalte für die Serie "${seriesName}" – optimiert für Google Discover.

**VERFÜGBARE DATEN:**
- Serie: ${seriesName}
- Genre: ${genreText}
- Sender/Plattform: ${networkText}
- Jahr: ${yearText}
- Staffeln: ${seasonsText}
- Status: ${status || 'unbekannt'}
- Schöpfer: ${creatorText}
- Hauptdarsteller: ${mainCast || 'diverse'}
- TMDB-Beschreibung: "${overview}"

---

**ABSCHNITT 1: EVERGREEN-INTRO**
Überschrift: "Worum geht es in ${seriesName}?"

Schreibe 300–400 Wörter im neutral-journalistischen Stil:
- Erkläre Genre, Ton, Grundidee
- Kulturelle Relevanz & Erfolg
- Einordnung in die TV-Landschaft
- KEINE Spoiler
- KEINE Listen
- KEINE Wiederholung der TMDB-Beschreibung
- Journalistisch, nicht marketing

Format: Fließtext in 3-4 Absätzen

---

**ABSCHNITT 2: SERIEN-STATUS**
Überschrift: "Aktueller Stand der Serie"

Schreibe 100–150 Wörter:
- Aktueller Status (läuft/pausiert/beendet)
- Bestätigte Staffeln
- Produktionsstatus (nur Fakten)
- KEINE Gerüchte
- KEINE Spekulation

Format: Fließtext

---

**ABSCHNITT 3: NEWS-KONTEXT**
Überschrift: "Aktuelle News zu ${seriesName}"

Schreibe 2–3 Sätze:
- Redaktionelle Einleitung zur News-Liste
- Erklärt, dass hier relevante Meldungen gesammelt sind
- KEIN Marketing
- KEIN "Hier findest du..."

Format: Kurzer Absatz

---

**ABSCHNITT 4: MINI-Q&A**
Überschrift: "Kurz erklärt"

Erstelle exakt 3 Fragen mit kurzen Antworten:
- Nur Fakten aus den gegebenen Daten
- Keine Spekulation
- Kein Clickbait
- Praktische Fragen wie: Wo läuft die Serie? Wie viele Staffeln gibt es? Wer spielt mit?

Format: JSON Array mit {question, answer}

---

**WICHTIGE REGELN:**
1. KEIN Markdown (keine **, keine #, keine _)
2. Nur reiner Text
3. Keine generischen KI-Phrasen
4. Journalistisch, präzise, sachlich
5. Minimum 250 Wörter für Abschnitt 1

**AUSGABE-FORMAT:**
Gib die Antwort im folgenden JSON-Format zurück:
{
  "evergreenIntro": "Text für Abschnitt 1...",
  "seriesStatus": "Text für Abschnitt 2...",
  "newsContext": "Text für Abschnitt 3...",
  "miniQA": [
    {"question": "Frage 1?", "answer": "Antwort 1"},
    {"question": "Frage 2?", "answer": "Antwort 2"},
    {"question": "Frage 3?", "answer": "Antwort 3"}
  ]
}

Schreibe jetzt die Inhalte:`;

  try {
    const { url: llmUrl, headers: llmHeaders, model: llmModel } = (await import('./llm-config')).getLLMFetchConfig();
    const response = await fetch(llmUrl, {
      method: 'POST',
      headers: llmHeaders,
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: 'system',
            content: 'Du bist ein professioneller TV-Redakteur. Du schreibst sachlich, journalistisch und präzise. Du gibst Antworten immer im angeforderten JSON-Format zurück.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Parse JSON response
    const parsedContent = parseJsonResponse(content);

    // Validate minimum length
    if (parsedContent.evergreenIntro.length < 250) {
      console.warn('⚠️  Evergreen intro too short, regenerating...');
      // Could implement retry logic here
    }

    return parsedContent;

  } catch (error) {
    console.error('Error generating Discover content:', error);
    
    // Fallback content
    return {
      evergreenIntro: `${seriesName} ist eine ${genreText}-Serie, die ${yearText} auf ${networkText} startete. Die Serie hat sich zu einem wichtigen Teil der modernen TV-Landschaft entwickelt und zieht ein breites Publikum an.`,
      seriesStatus: `Die Serie ${seriesName} umfasst aktuell ${seasonsText}. Der Status der Produktion wird regelmäßig aktualisiert.`,
      newsContext: `Alle wichtigen Meldungen und Updates zu ${seriesName} finden sich in der folgenden Übersicht.`,
      miniQA: [
        { question: `Wo läuft ${seriesName}?`, answer: `Die Serie ist auf ${networkText} verfügbar.` },
        { question: `Wie viele Staffeln gibt es?`, answer: seasonsText || 'Die Anzahl wird noch bekannt gegeben.' },
        { question: 'Wer spielt die Hauptrolle?', answer: mainCast || 'Das Cast wird noch bekannt gegeben.' },
      ],
    };
  }
}
