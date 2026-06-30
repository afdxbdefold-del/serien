/**
 * Server-Side Helper für globale Tags.
 * Wird auf Artikelseiten verwendet, um aktive Tags an der richtigen
 * Position zu rendern. Liest direkt aus der DB (kein Self-fetch über HTTP).
 *
 * Bot-Filter: dieselbe UA-Heuristik wie der ArticleInterstitial. Bots
 * (Googlebot, Bingbot, Lighthouse, Headless, etc.) bekommen NULL zurück
 * — damit Crawler keine paid Creatives sehen und unsere Discover-/SEO-
 * Bewertung nicht durch Third-Party-Scripts versaut wird.
 */
import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

export type Placement = 'head' | 'body-start' | 'body-end';

export interface GlobalTag {
  id: string;
  name: string;
  html: string;
  placement: Placement;
  hideFromBots: boolean;
  sortOrder: number;
}

const BOT_RE =
  /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|petalbot|ahrefs|semrush|mj12bot|dotbot|prerender|headlesschrome|phantomjs|lighthouse|chrome-lighthouse|pagespeed|gtmetrix|pingdom|webpagetest/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_RE.test(ua);
}

const getActiveTagsCached = unstable_cache(
  async () => {
    const tags = await prisma.global_tags.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        html: true,
        placement: true,
        hideFromBots: true,
        sortOrder: true,
      },
    });
    return tags as GlobalTag[];
  },
  ['global-tags-active'],
  { tags: ['global-tags'], revalidate: 300 },
);

/**
 * Aktive Tags für einen bestimmten Placement zurückgeben.
 * `userAgent` wird benutzt, um Bot-Traffic zu filtern (Tags mit
 * hideFromBots=true werden für Bots übersprungen).
 */
export async function getGlobalTagsFor(
  placement: Placement,
  userAgent: string | null | undefined,
): Promise<GlobalTag[]> {
  const all = await getActiveTagsCached();
  const isBot = isBotUserAgent(userAgent);
  return all.filter((t) => {
    if (t.placement !== placement) return false;
    if (isBot && t.hideFromBots) return false;
    return true;
  });
}
