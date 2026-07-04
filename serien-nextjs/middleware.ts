import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INDEXNOW_KEY = '8e6827d79c19f8cbe91089129c21e303';

// Google App / Discover User-Agent patterns
const DISCOVER_UA_PATTERNS = [
  'GSA/',                // Google Search App (Android)
  'GoogleApp/',          // Google App (iOS)
  'com.google.android.googlequicksearchbox',
  'Google-Read-Aloud',   // Google Discover read-aloud
];

// Search engine / news crawler detection.
// First match wins — order matters (News before general Googlebot).
const BOT_PATTERNS: Array<[string, RegExp]> = [
  ['Googlebot-News',         /Googlebot-News/i],
  ['Googlebot-Image',        /Googlebot-Image/i],
  ['Googlebot-Smartphone',   /Googlebot\/[^)]*(Mobile|Android|iPhone)/i],
  ['Googlebot',              /Googlebot/i],
  ['Bingbot',                /bingbot/i],
  ['YandexBot',              /YandexBot/i],
  ['DuckDuckBot',            /DuckDuckBot/i],
  ['Applebot',               /Applebot/i],
  ['FacebookExternalHit',    /facebookexternalhit|facebookcatalog/i],
  ['Twitterbot',             /Twitterbot/i],
  ['LinkedInBot',            /LinkedInBot/i],
  ['SeznamBot',              /SeznamBot/i],
  ['Baiduspider',            /Baiduspider/i],
  ['PetalBot',               /PetalBot/i],
  ['SemrushBot',             /SemrushBot/i],
  ['AhrefsBot',              /AhrefsBot/i],
  ['GPTBot',                 /GPTBot/i],
  ['ClaudeBot',              /ClaudeBot|anthropic-ai/i],
  ['PerplexityBot',          /PerplexityBot/i],
  ['Google-InspectionTool',  /Google-InspectionTool/i],
];

// Hostile bots die AdSense-Impressions verbrennen → hart mit 204 blocken
// bevor die HTML-Page überhaupt gerendert wird. Legitimate Search-Engines
// (Google/Bing/DuckDuck etc.) sind bewusst NICHT hier — sie kriegen die
// Page normal weil wir SEO-Signal brauchen. Diese Liste ist der Grund
// warum AdSense uns wegen Invalid Traffic gesperrt hat: China-/Asia-
// Botnetze + Http-Client-Scraper laden Artikel und counten als Ad-Views.
const HOSTILE_BOT_PATTERNS: RegExp[] = [
  /Bytespider/i,                    // ByteDance/TikTok Scraper (CN)
  /YisouSpider/i,                   // Yisou/Aliyun (CN)
  /Sogou (web spider|inst spider)/i, // Sogou (CN)
  /MJ12bot/i,                       // Majestic (excessive crawler)
  /DotBot/i,                        // Moz DotBot (excessive)
  /MegaIndex/i,                     // MegaIndex (RU)
  /BLEXBot/i,                       // WebMeUp
  /SEOkicks/i,
  /SISTRIX Crawler/i,
  /DataForSeoBot/i,
  /Adsbot/i,                        // Amazonbot / diverse Ad-Scanner
  /Amazonbot/i,
  /ImagesiftBot/i,
  /HeadlessChrome/i,                // Puppeteer-Default (klarer Bot-Signal)
  /PhantomJS/i,
  /Selenium/i,
  /(python-requests|python-urllib|Go-http-client|Java\/|Go 1\.|okhttp|axios|node-fetch|libwww-perl|curl\/|wget\/)/i,
];

// Länder mit hoher IVT-Rate laut AdSense-Payouts + Botnet-Präsenz.
// Bei generischer Browser-UA (nicht als Search-Bot erkannt) aus diesen
// Ländern → 204 zurückgeben. serien.de ist DACH-fokussiert, echte User
// aus diesen Regionen sind für uns statistisch irrelevant.
const HIGH_FRAUD_COUNTRIES = new Set([
  'CN', // China
  'HK', // Hongkong
  'MO', // Macau
  'VN', // Vietnam
  'ID', // Indonesien
  'IN', // Indien
  'PK', // Pakistan
  'BD', // Bangladesch
  'MY', // Malaysia
  'PH', // Philippinen
  'TH', // Thailand
  'MM', // Myanmar
  'KH', // Kambodscha
  'LK', // Sri Lanka
  'NP', // Nepal
  'NG', // Nigeria
  'EG', // Ägypten
  'IR', // Iran (auch häufig Botnet-Origin)
]);

function isHostileBot(ua: string): boolean {
  if (!ua) return true; // leerer UA = eindeutiger Bot
  return HOSTILE_BOT_PATTERNS.some((re) => re.test(ua));
}

function detectBot(ua: string): string | null {
  for (const [id, re] of BOT_PATTERNS) {
    if (re.test(ua)) return id;
  }
  return null;
}

export function middleware(request: NextRequest) {
  // Serve IndexNow verification file as plain text
  if (request.nextUrl.pathname === `/${INDEXNOW_KEY}.txt`) {
    return new NextResponse(INDEXNOW_KEY, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Skip API routes and static assets
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/') || path.startsWith('/_next/') || path.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // ========================================================================
  // AD-FRAUD FIREWALL (Feb 2026) — kritisch nach AdSense-Sperre wegen IVT
  //
  // AdSense hat unser Konto wegen zu vieler bot-generierter Ad-Impressions
  // gesperrt (v.a. CN/Asia-Botnetze). Bevor die HTML-Page mit AdSense-Tags
  // an Bots ausgeliefert wird → hier hart 204 zurückgeben. Läuft VOR ISR-
  // Cache, damit auch gecachte Artikel nicht mehr an Bots geliefert werden.
  //
  // Strategie:
  //  1. Good-Bot-Check zuerst (Googlebot, Bingbot, …) → durchlassen (SEO!)
  //  2. Hostile-Bot-UA → 204
  //  3. Generischer Browser-UA aus High-Fraud-Country → 204
  //     (echte DACH-User werden nicht getroffen, User aus DE/AT/CH/EU
  //      passieren unauffällig)
  //
  // Verifikation via `x-vercel-ip-country` Header — Vercel Edge liefert
  // Land-Code aus dem GeoIP-Lookup. In Dev/Local ist der Header leer,
  // dann greift nur die UA-basierte Regel.
  // ========================================================================
  const uaAd = request.headers.get('user-agent') || '';
  const goodBot = detectBot(uaAd);

  if (!goodBot) {
    // Nur Non-Search-Bot-Traffic wird geprüft — Googlebot etc. müssen
    // die volle Page sehen.
    if (isHostileBot(uaAd)) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'x-block-reason': 'hostile-bot-ua' },
      });
    }

    const country = request.headers.get('x-vercel-ip-country') || '';
    if (country && HIGH_FRAUD_COUNTRIES.has(country.toUpperCase())) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'x-block-reason': 'high-fraud-country',
          'x-block-country': country,
        },
      });
    }
  }

  // ========================================================================
  // LEGACY DUPLICATE-SLUG REDIRECTS (permanent, 301)
  //
  // A handful of 2021-era articles ended up with two slugs for the same
  // story (e.g. "bruised-netflix" + "bruised-netflix-film-2021"). We pick
  // the canonical slug and 301 the others, then depublish the duplicate
  // record. This preserves any backlinks while removing duplicate-content
  // signals from Search Console.
  // ========================================================================
  const LEGACY_DUP_REDIRECTS: Record<string, string> = {
    '/vikings-valhalla-2': '/vikings-valhalla-erscheinungsdatum-handlung-und-besetzung',
    '/neu-auf-netflix-jeder-film-und-jede-serie-im-august-2021': '/neu-auf-netflix',
    '/bruised-netflix-film-2021': '/bruised-netflix',
  };
  if (LEGACY_DUP_REDIRECTS[path]) {
    return NextResponse.redirect(`${request.nextUrl.origin}${LEGACY_DUP_REDIRECTS[path]}`, 301);
  }

  // ========================================================================
  // LEGACY WORDPRESS FEED REDIRECTS (permanent, 301)
  //
  // serien.de used to run on WordPress. Googlebot still crawls the old
  // feed URLs years later. We map them to their semantic equivalents on
  // the new stack so Google reindexes with equity intact instead of 404-ing.
  // ======================================================================== Googlebot still crawls the old
  // feed URLs years later. We map them to their semantic equivalents on
  // the new stack so Google reindexes with equity intact instead of 404-ing.
  // ========================================================================
  const origin = request.nextUrl.origin;

  // /feed/gn  = WordPress Google News Sitemap plugin endpoint → our news-sitemap.xml
  if (path === '/feed/gn' || path === '/feed/gn/') {
    return NextResponse.redirect(`${origin}/news-sitemap.xml`, 301);
  }

  // /feed, /feed/, /feed/rss, /feed/atom  = site-wide RSS → our sitemap
  if (/^\/feed(\/(rss|rss2|atom|rdf)?)?\/?$/i.test(path)) {
    return NextResponse.redirect(`${origin}/sitemap.xml`, 301);
  }

  // /comments/feed, /author/<slug>/feed  = gone for good (must run BEFORE the generic [slug]/feed rule)
  if (path === '/comments/feed' || path === '/comments/feed/' || /^\/author\/[^/]+\/feed\/?$/i.test(path)) {
    return new NextResponse('Gone', {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // /<slug>/feed  = WordPress per-post RSS → the post itself (content-equivalent)
  const postFeedMatch = path.match(/^\/([^/]+)\/feed\/?$/i);
  if (postFeedMatch && !path.startsWith('/feed/')) {
    return NextResponse.redirect(`${origin}/${postFeedMatch[1]}`, 301);
  }

  // ?feed=... query-string variant → strip query and 301 to clean URL
  const feedQuery = request.nextUrl.searchParams.get('feed');
  if (feedQuery) {
    const clean = new URL(request.nextUrl);
    clean.searchParams.delete('feed');
    return NextResponse.redirect(clean, 301);
  }

  // Set x-pathname on the REQUEST headers so server components (e.g. root
  // layout) can conditionally render based on the current path — e.g. skip
  // the AdSense script on admin pages (ads are allowed only on article
  // pages per user policy). NextResponse.next({ request: { headers } })
  // is the documented way to pass headers through to the rendering layer.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', path);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Crawler tracking: fire-and-forget POST to internal endpoint.
  // Middleware runs on every request (no ISR caching), so this catches every bot hit.
  const ua = request.headers.get('user-agent') || '';
  const bot = detectBot(ua);
  if (bot) {
    // fetch is non-blocking here; response is already routed.
    fetch(`${origin}/api/track/crawler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot,
        path,
        userAgent: ua.slice(0, 500),
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      }),
      // @ts-expect-error: Node-style keepalive hint; safe on edge
      keepalive: true,
    }).catch(() => {});
  }

  // (b) Server-side Referrer capture
  const referer = request.headers.get('referer') || '';
  if (referer) {
    response.cookies.set('_ssref', referer, {
      path: '/',
      maxAge: 60, // Only valid for 60s (just for the initial page load)
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  // (d) User-Agent based Discover detection
  const isDiscover = DISCOVER_UA_PATTERNS.some(p => ua.includes(p));
  if (isDiscover) {
    response.cookies.set('_ssrc', 'discover', {
      path: '/',
      maxAge: 60,
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    '/8e6827d79c19f8cbe91089129c21e303.txt',
  ],
};
