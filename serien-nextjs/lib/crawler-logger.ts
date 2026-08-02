/**
 * Detects and logs search engine / news crawlers.
 * Used by server-rendered routes (news-sitemap, sitemap, article pages) to
 * track crawl frequency per bot.
 */
import prisma from './prisma';

interface BotPattern {
  id: string;
  regex: RegExp;
}

// Ordered: first match wins.
const BOT_PATTERNS: BotPattern[] = [
  { id: 'Googlebot-News',    regex: /Googlebot-News/i },
  { id: 'Googlebot-Image',   regex: /Googlebot-Image/i },
  { id: 'Googlebot-Smartphone', regex: /Googlebot\/[^)]*(Mobile|Android|iPhone)/i },
  { id: 'Googlebot',         regex: /Googlebot\/2\.1|Googlebot \(compatible|Googlebot/i },
  { id: 'Bingbot',           regex: /bingbot/i },
  { id: 'YandexBot',         regex: /YandexBot/i },
  { id: 'DuckDuckBot',       regex: /DuckDuckBot/i },
  { id: 'Applebot',          regex: /Applebot/i },
  { id: 'FacebookExternalHit', regex: /facebookexternalhit|facebookcatalog/i },
  { id: 'Twitterbot',        regex: /Twitterbot/i },
  { id: 'LinkedInBot',       regex: /LinkedInBot/i },
  { id: 'SeznamBot',         regex: /SeznamBot/i },
  { id: 'Baiduspider',       regex: /Baiduspider/i },
  { id: 'PetalBot',          regex: /PetalBot/i },
  { id: 'SemrushBot',        regex: /SemrushBot/i },
  { id: 'AhrefsBot',         regex: /AhrefsBot/i },
  { id: 'GPTBot',            regex: /GPTBot/i },
  { id: 'ClaudeBot',         regex: /ClaudeBot|anthropic-ai/i },
  { id: 'PerplexityBot',     regex: /PerplexityBot/i },
  { id: 'Google-InspectionTool', regex: /Google-InspectionTool/i },
];

export function detectBot(userAgent: string | null): string | null {
  if (!userAgent) return null;
  for (const p of BOT_PATTERNS) {
    if (p.regex.test(userAgent)) return p.id;
  }
  return null;
}

/**
 * Fire-and-forget hit logger. Never throws, never delays the response.
 * Feb 2026: Tracking komplett abgeschaltet (User-Vorgabe). Funktion bleibt
 * als No-Op erhalten, damit Aufrufer in sitemap.xml / news-sitemap.xml
 * unverändert bleiben und die Import-Kette nicht kaputt geht.
 */
export async function logCrawlerHit(_opts: {
  userAgent: string | null;
  path: string;
  ip?: string | null;
}): Promise<void> {
  return;
}
