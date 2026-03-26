/**
 * Editorial Context Generation for Series Hubs
 * UPDATED: Discover-Optimierung gemäß Instruction (März 2026)
 * 
 * MODUL 0: "Warum relevant"-Box (kulturelle/Markt-Relevanz, KEIN News-Ton)
 * MODUL 1: Status Context (NUR bei echtem Mehrwert, keine Redundanz)
 */

interface RelevanceContext {
  text: string;
  type: 'cultural' | 'market' | 'genre' | 'impact';
}

/**
 * MODUL 0: Generate "Warum relevant"-Context
 * Fokus: Kulturelle/Markt-Relevanz, evergreen Tonalität
 * NICHT: Event-basiert, News-Ton, künstliche Zeitstempel
 */
export async function generateRelevanceContext(
  seriesName: string,
  overview: string,
  status: string,
  voteAverage: number,
  numberOfSeasons: number
): Promise<RelevanceContext | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      return generateFallbackRelevance(seriesName, overview, status, voteAverage);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `Du erstellst eine "Warum relevant"-Box für Serien-Hubs.

VERBOTEN:
- Tagesaktuelle News simulieren
- Event-basierte Hooks
- Marketing-Phrasen
- Künstliche Zeitstempel

ERLAUBT:
- Kulturelle Relevanz erklären
- Genre-Einordnung
- Markt-Position
- Langfristige Bedeutung

Erstelle 1-2 präzise Sätze in evergreen Tonalität.
Return JSON: {"text":"...","type":"cultural|market|genre|impact"}`
          },
          {
            role: 'user',
            content: `Serie: ${seriesName}
Overview: ${overview}
Status: ${status}
Rating: ${voteAverage}/10
Staffeln: ${numberOfSeasons}

Erstelle evergreen "Warum relevant"-Erklärung (kulturelle/Markt-Relevanz, KEIN News-Ton).`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      return generateFallbackRelevance(seriesName, overview, status, voteAverage);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return generateFallbackRelevance(seriesName, overview, status, voteAverage);
    }

    const parsed = JSON.parse(content);
    
    if (parsed.text && parsed.text.length > 20) {
      return {
        text: parsed.text,
        type: parsed.type || 'cultural'
      };
    }

    return generateFallbackRelevance(seriesName, overview, status, voteAverage);

  } catch (error) {
    return generateFallbackRelevance(seriesName, overview, status, voteAverage);
  }
}

/**
 * Fallback: Evergreen Relevanz ohne LLM
 */
function generateFallbackRelevance(
  seriesName: string,
  overview: string,
  status: string,
  voteAverage: number
): RelevanceContext {
  const isHighRated = voteAverage >= 8.0;
  const overview_lower = overview.toLowerCase();
  
  if (isHighRated && overview_lower.includes('drama')) {
    return {
      text: `${seriesName} gehört zu den höher bewerteten Drama-Serien und zeigt, wie das Genre erzählerisch erweitert werden kann – jenseits klassischer Konventionen.`,
      type: 'genre'
    };
  }
  
  if (overview_lower.includes('thriller') || overview_lower.includes('crime')) {
    return {
      text: `${seriesName} bedient ein Genre, das auf Streaming-Plattformen besonders stark nachgefragt wird – Thriller mit komplexen Figuren und verzweigten Plots.`,
      type: 'market'
    };
  }
  
  if (status === 'Ended' && isHighRated) {
    return {
      text: `${seriesName} hat als abgeschlossene Serie den Vorteil, dass Zuschauer die komplette Story ohne Wartezeiten erleben können – ein Faktor, der im Streaming-Zeitalter zunehmend geschätzt wird.`,
      type: 'cultural'
    };
  }
  
  return {
    text: `${seriesName} zeigt, wie Serien heute erzählt werden: mit Fokus auf Charaktertiefe und einer Bereitschaft, etablierte Genre-Grenzen zu verschieben.`,
    type: 'cultural'
  };
}

/**
 * MODUL 1: Generate Status Context (NUR bei echtem Mehrwert)
 * UPDATED: Strengere Bedingungen – keine Redundanz
 * 
 * Rendert NUR wenn:
 * - Platform-Kontext vorhanden UND relevant
 * - ODER zeitliche Unsicherheit
 * - NICHT bei eindeutigen Status (Ended/Canceled)
 */
export function generateStatusContext(
  status: string,
  seriesName: string,
  platform?: string,
  lastAirDate?: Date | null,
  numberOfSeasons?: number | null
): string | null {
  // REGEL 1: Nur fortlaufende Serien brauchen Kontext
  if (status !== 'Returning Series' && status !== 'In Production') {
    return null; // Ended/Canceled ist eindeutig
  }

  // REGEL 2: Platform-Kontext nur wenn ECHTER Mehrwert
  const platformPatterns: Record<string, string> = {
    'Apple TV+': 'Apple TV+ veröffentlicht neue Staffeln vergleichbarer Serien meist rund ein Jahr nach der vorherigen Staffel',
    'Apple TV': 'Apple TV+ veröffentlicht neue Staffeln vergleichbarer Serien meist rund ein Jahr nach der vorherigen Staffel',
    'Netflix': 'Netflix entscheidet bei vergleichbaren Produktionen oft innerhalb von 6–12 Monaten nach Staffelstart über eine Fortsetzung',
    'HBO': 'HBO nimmt sich für hochwertige Produktionen dieser Art typischerweise 18–24 Monate Zeit',
    'Amazon Prime': 'Amazon Prime Video kündigt Verlängerungen oft erst Monate nach Veröffentlichung an',
    'Amazon Prime Video': 'Amazon Prime Video kündigt Verlängerungen oft erst Monate nach Veröffentlichung an',
    'Disney+': 'Disney+ erneuert erfolgreiche Eigenproduktionen meist zeitnah, die Produktion dauert dann aber 12–18 Monate',
  };

  const platformContext = platform ? platformPatterns[platform] : null;

  // REGEL 3: Nur rendern wenn Platform-Kontext vorhanden
  if (!platformContext) {
    return null; // Kein Mehrwert ohne Platform-Info
  }

  // REGEL 4: Zeitliche Einordnung optional
  let timeContext = '';
  if (lastAirDate) {
    const daysSinceLastEpisode = Math.floor(
      (Date.now() - lastAirDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLastEpisode > 365) {
      timeContext = ' Die letzte Episode lief vor über einem Jahr.';
    }
  }

  // FINALE AUSGABE
  return `💡 Für Fans heißt das: Die Serie ist offiziell nicht beendet. ${platformContext}.${timeContext}`;
}
