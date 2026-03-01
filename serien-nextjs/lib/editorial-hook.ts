/**
 * Editorial Hook Generator
 * Generates event-based editorial intro for Series Hub (MODUL 0)
 * Based on latest articles to trigger Google Discover
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface EditorialHookData {
  hook: string;
  lastUpdated: Date;
}

/**
 * Generate editorial hook based on latest article
 * 60-100 words, interprets recent event, NO explanations
 */
export async function generateEditorialHook(
  seriesTmdbId: number,
  seriesName: string
): Promise<EditorialHookData | null> {
  try {
    // Get the most recent published article for this series
    const latestArticle = await prisma.articles.findFirst({
      where: {
        primarySeriesId: seriesTmdbId,
        status: 'published',
      },
      orderBy: {
        publishedAt: 'desc',
      },
      select: {
        title: true,
        excerpt: true,
        publishedAt: true,
        contentHtml: true,
      },
    });

    if (!latestArticle) {
      return null;
    }

    // Check if article is recent (within last 30 days)
    const daysSincePublish = Math.floor(
      (Date.now() - new Date(latestArticle.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePublish > 30) {
      // Too old for editorial hook
      return null;
    }

    // Extract key phrases from article title for context
    const lowerTitle = latestArticle.title.toLowerCase();
    
    // Detect event type from title
    let eventContext = '';
    if (lowerTitle.includes('staffel') && lowerTitle.includes('start')) {
      eventContext = 'Staffelstart';
    } else if (lowerTitle.includes('finale') || lowerTitle.includes('episode')) {
      eventContext = 'Episode';
    } else if (lowerTitle.includes('besetzt') || lowerTitle.includes('cast')) {
      eventContext = 'Besetzung';
    } else if (lowerTitle.includes('verlängert') || lowerTitle.includes('staffel')) {
      eventContext = 'Staffelnews';
    } else if (lowerTitle.includes('trailer')) {
      eventContext = 'Trailer';
    } else {
      eventContext = 'News';
    }

    // Generate contextual hook based on event
    const hooks = {
      'Staffelstart': [
        `Mit dem Start der neuen Staffel stellt sich ${seriesName} erneut der Frage: Wie weit kann eine Serie ihren Ton verändern, ohne die Bindung zum Publikum zu verlieren? Die Reaktionen zeigen, dass nicht alle Fans diesen Schritt mitgehen.`,
        `Der Staffelstart von ${seriesName} wirft mehr Fragen auf als er beantwortet. Wird die Serie ihrer eigenen Prämisse treu bleiben – oder ist das, was Fans an ihr schätzten, längst einer anderen Vision gewichen?`,
        `${seriesName} kehrt zurück, und die ersten Reaktionen sind gespalten. Was bedeutet das für eine Serie, die bislang für ihren konstanten Ton bekannt war?`,
      ],
      'Episode': [
        `Die jüngste Episode von ${seriesName} hat eine Wendung genommen, die Fans unterschiedlich bewerten. Ist das ein mutiger Schritt – oder ein Bruch mit dem, was die Serie auszeichnete?`,
        `${seriesName} hat mit der letzten Folge eine Entwicklung angestoßen, über die sich diskutieren lässt. Bleibt die Serie ihrem Kern treu, oder justiert sie ihre Richtung neu?`,
        `Was die neueste Episode von ${seriesName} bedeutet, hängt davon ab, welche Erwartungen man an die Serie hatte. Manche sehen darin eine logische Fortführung, andere einen Wendepunkt.`,
      ],
      'Besetzung': [
        `Mit der Bekanntgabe neuer Cast-Mitglieder stellt sich für ${seriesName} die Frage: Wie verändert sich eine Serie, wenn zentrale Figuren oder neue Gesichter hinzukommen?`,
        `${seriesName} erweitert seine Besetzung – ein Schritt, der bei Fans sowohl Neugier als auch Skepsis auslöst. Wird die Dynamik der Serie davon profitieren?`,
      ],
      'Staffelnews': [
        `Die Ankündigung einer weiteren Staffel von ${seriesName} wirft die Frage auf: Hat die Serie noch Raum, ihre Geschichte sinnvoll weiterzuerzählen – oder wird sie zur Verlängerung um ihrer selbst willen?`,
        `${seriesName} wird fortgesetzt. Für manche Fans eine gute Nachricht, für andere der Moment, an dem eine Serie ihre ursprüngliche Relevanz hinterfragt werden muss.`,
      ],
      'Trailer': [
        `Der neue Trailer zu ${seriesName} verspricht viel – aber lässt auch Raum für Zweifel. Was genau die Serie mit dieser Staffel vorhat, bleibt offen.`,
        `${seriesName} zeigt sich im neuen Trailer von einer anderen Seite. Ob das bei Fans ankommt, wird sich erst mit den ersten Episoden zeigen.`,
      ],
      'News': [
        `Die jüngsten Entwicklungen rund um ${seriesName} zeigen: Die Serie bleibt ein Diskussionsthema. Was das für ihre Zukunft bedeutet, ist noch unklar.`,
        `${seriesName} sorgt erneut für Gespräche – allerdings nicht unbedingt aus den Gründen, die sich die Macher erhofft haben könnten.`,
      ],
    };

    // Select random hook from context category
    const contextHooks = hooks[eventContext as keyof typeof hooks] || hooks['News'];
    const selectedHook = contextHooks[Math.floor(Math.random() * contextHooks.length)];

    return {
      hook: selectedHook,
      lastUpdated: latestArticle.publishedAt,
    };

  } catch (error) {
    console.error('Error generating editorial hook:', error);
    return null;
  }
}

/**
 * Generate status context (MODUL 1) - OPTIMIZED
 * Only returns context if it adds REAL VALUE beyond the status itself
 * 
 * Requirements:
 * - Must add NEW information (timeframe, production context, platform pattern, or fan implication)
 * - NO repetition of status field
 * - NO filler text
 * - Editorial tone, 1-2 sentences max
 * - If no insight possible, returns NULL (box not rendered)
 */
export function generateStatusContext(
  status: string | null, 
  seriesName: string,
  platform?: string,
  lastAirDate?: Date | null,
  numberOfSeasons?: number | null
): string | null {
  if (!status) return null;

  // Calculate days since last episode (if available)
  const daysSinceLastEpisode = lastAirDate 
    ? Math.floor((Date.now() - new Date(lastAirDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Platform-specific release patterns
  const platformPatterns: Record<string, string> = {
    'Apple TV+': 'Apple TV+ veröffentlicht neue Staffeln vergleichbarer Serien meist rund ein Jahr nach der vorherigen Staffel',
    'Netflix': 'Netflix entscheidet bei vergleichbaren Produktionen oft innerhalb von 6–12 Monaten nach Staffelstart über eine Fortsetzung',
    'HBO': 'HBO nimmt sich für hochwertige Produktionen dieser Art typischerweise 18–24 Monate Zeit',
    'Amazon Prime': 'Amazon Prime Video kündigt Verlängerungen oft erst Monate nach Veröffentlichung an',
    'Disney+': 'Disney+ erneuert erfolgreiche Eigenproduktionen meist zeitnah, die Produktion dauert dann aber 12–18 Monate',
  };

  const platformContext = platform ? platformPatterns[platform] : null;

  // Status-specific contexts (only with REAL insight)
  switch (status.toLowerCase()) {
    case 'returning series':
      // Only show if we can add timeframe or production context
      if (platformContext) {
        return `Für Fans heißt das: Die Serie ist offiziell nicht beendet. ${platformContext}.`;
      }
      if (daysSinceLastEpisode && daysSinceLastEpisode > 365 && daysSinceLastEpisode < 730) {
        return `Die letzte Staffel liegt über ein Jahr zurück – ein typisches Intervall für Premium-Serien, aber ohne offizielle Ankündigung bleibt die Wartezeit unklar.`;
      }
      if (daysSinceLastEpisode && daysSinceLastEpisode > 730) {
        return `Mit mehr als zwei Jahren seit der letzten Staffel wächst die Unsicherheit bei Fans – selbst bei offiziell laufenden Serien kann eine solche Pause auf Produktionsprobleme hindeuten.`;
      }
      // If no additional context: return null (no box)
      return null;

    case 'ended':
      // Only show if there's something meaningful to say
      if (numberOfSeasons && numberOfSeasons < 2) {
        return `${seriesName} wurde nach nur ${numberOfSeasons} Staffel${numberOfSeasons === 1 ? '' : 'n'} beendet – eine Entscheidung, die oft auf Zuschauerzahlen oder strategische Neuausrichtungen zurückgeht.`;
      }
      if (numberOfSeasons && numberOfSeasons >= 5) {
        return `Mit ${numberOfSeasons} Staffeln gehört ${seriesName} zu den langlebigeren Produktionen – ob die Serie ihre Geschichte vollständig erzählen konnte, bleibt Diskussionssache.`;
      }
      // Generic ended status: no additional value
      return null;

    case 'canceled':
      // Always add context for cancellations (high fan interest)
      if (numberOfSeasons === 1) {
        return `Die Absetzung nach nur einer Staffel deutet darauf hin, dass ${seriesName} die Erwartungen nicht erfüllt hat – ob narrative Bögen offen bleiben, hängt davon ab, wie die Macher mit der Unsicherheit umgingen.`;
      }
      if (numberOfSeasons && numberOfSeasons >= 3) {
        return `Nach ${numberOfSeasons} Staffeln abgesetzt zu werden wirft die Frage auf, ob ${seriesName} seine Geschichte zu Ende bringen konnte – ein häufiges Dilemma bei Serien mit komplexen Handlungsbögen.`;
      }
      return `Die Absetzung von ${seriesName} lässt offen, ob offene Handlungsstränge unbeantwortet bleiben – ein Risiko, das Fans bei der Investition in neue Serien zunehmend einkalkulieren müssen.`;

    case 'in production':
      // Add production timeline context
      if (platformContext) {
        return `Die Serie befindet sich in Produktion. ${platformContext}, was Fans einen groben Zeitrahmen gibt.`;
      }
      return `${seriesName} ist in Produktion – die Phase zwischen Drehschluss und Veröffentlichung dauert bei vergleichbaren Produktionen oft 6–12 Monate, je nach Umfang der Postproduktion.`;

    case 'planned':
      // Only show if we can add uncertainty/skepticism
      return `Die Serie ist angekündigt, aber noch nicht in Produktion – bei Projekten in diesem Stadium kann es zu Verzögerungen oder sogar zur Absage kommen, bevor eine einzige Szene gedreht wurde.`;

    case 'pilot':
      return `Nur ein Pilot wurde produziert – ein Stadium, in dem die meisten Projekte scheitern. Ob ${seriesName} tatsächlich zur Serie wird, ist völlig offen.`;

    default:
      // Unknown status or no meaningful context: return null
      return null;
  }
}
