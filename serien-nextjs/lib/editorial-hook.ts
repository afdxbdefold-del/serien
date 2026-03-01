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
 * Generate status context (MODUL 1)
 * One sentence explaining what status means for fans
 */
export function generateStatusContext(status: string | null, seriesName: string): string | null {
  if (!status) return null;

  const contexts: Record<string, string> = {
    'Returning Series': `Für Fans von ${seriesName} bedeutet das: Die Serie läuft weiter, aber wann genau neue Episoden erscheinen, bleibt vorerst offen.`,
    'Ended': `${seriesName} ist damit abgeschlossen – ob die Serie ihr Potenzial voll ausschöpfen konnte, bleibt Ansichtssache.`,
    'Canceled': `Die Absetzung von ${seriesName} wirft die Frage auf, ob die Serie ihre Geschichte zu Ende erzählen konnte, oder ob offene Fäden bleiben.`,
    'In Production': `${seriesName} befindet sich in Produktion – das lässt Raum für Spekulationen, in welche Richtung die neue Staffel gehen wird.`,
    'Planned': `Die Serie ist angekündigt, aber noch nicht in Produktion. Ob und wann ${seriesName} tatsächlich kommt, bleibt abzuwarten.`,
  };

  return contexts[status] || `Der Status "${status}" lässt offen, wie es mit ${seriesName} weitergeht.`;
}
