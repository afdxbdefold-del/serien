import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose/jwt/verify';
import { requireCronAuth } from '@/lib/cron-auth';

const INDEXNOW_KEY = '8e6827d79c19f8cbe91089129c21e303';
const ADMIN_ONLY_API_PATHS = new Set([
  '/api/debug/llm-version',
  '/api/qa/generate',
]);

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

async function authorizeAdminApi(request: NextRequest): Promise<NextResponse | null> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return NextResponse.json(
      { detail: 'Admin authentication is not configured' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  const token = bearerToken || request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ['HS256'] }
    );

    if (!payload.userId || payload.role !== 'admin') {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // Serve IndexNow verification file as plain text
  if (request.nextUrl.pathname === `/${INDEXNOW_KEY}.txt`) {
    return new NextResponse(INDEXNOW_KEY, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const path = request.nextUrl.pathname;

  // Every admin API is protected centrally. Individual route checks remain
  // defence in depth, but an omitted or broken local check can no longer make
  // a mutating endpoint public. The login endpoint is the sole exception.
  const requiresAdmin =
    (path.startsWith('/api/admin/') && path !== '/api/admin/auth/login') ||
    ADMIN_ONLY_API_PATHS.has(path);

  if (requiresAdmin) {
    const authFailure = await authorizeAdminApi(request);
    if (authFailure) return authFailure;
    return NextResponse.next();
  }

  if (path.startsWith('/api/cron/')) {
    const authFailure = requireCronAuth(request);
    if (authFailure) return authFailure;
    return NextResponse.next();
  }

  // Skip other API routes and static assets
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
  // Verifikation via `cf-ipcountry` Header — Cloudflare setzt den auf allen
  // proxied Zones. Fallback auf `x-vercel-ip-country` bleibt drin für den
  // Notfall-Rollback nach Vercel. In Dev/Local ist der Header leer,
  // dann greift nur die UA-basierte Regel.
  // ========================================================================
  const uaAd = request.headers.get('user-agent') || '';
  const goodBot = detectBot(uaAd);
  const origin_early = request.nextUrl.origin;

  const fireBlockLog = (reason: string, country: string, botSignal: string) => {
    // Fire-and-forget an internen Endpoint. 10 % Sampling (Feb 2026 Cost-Opt.):
    // spart 90 % der Extra-Function-Invocations. Dashboard-Werte × 10 hochrechnen.
    if (Math.random() >= 0.1) return;
    fetch(`${origin_early}/api/track/adfraud-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, country, botSignal: botSignal.slice(0, 80) }),
      keepalive: true,
    }).catch(() => {});
  };

  if (!goodBot) {
    // Nur Non-Search-Bot-Traffic wird geprüft — Googlebot etc. müssen
    // die volle Page sehen.
    if (isHostileBot(uaAd)) {
      // Erstes matchendes hostile pattern loggen für Debug/Stats
      const matched = HOSTILE_BOT_PATTERNS.find((re) => re.test(uaAd));
      const sig = matched ? matched.source.replace(/[/\\^$.*+?()[\]{}|]/g, '').slice(0, 60) : 'unknown';
      fireBlockLog('hostile-bot-ua', '', sig);
      return new NextResponse(null, {
        status: 204,
        headers: { 'x-block-reason': 'hostile-bot-ua' },
      });
    }

    const country = (
      request.headers.get('cf-ipcountry') ||           // Cloudflare (Proxied Zone) — Post-Hetzner-Migration primär
      request.headers.get('x-vercel-ip-country') ||    // Vercel Edge (Legacy, für Rollback)
      ''
    );
    if (country && HIGH_FRAUD_COUNTRIES.has(country.toUpperCase())) {
      fireBlockLog('high-fraud-country', country.toUpperCase(), '');
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

  // Crawler-Tracking: komplett abgeschaltet (Feb 2026, User-Vorgabe).
  // Weder crawler_hits noch analytics_events werden noch beschrieben —
  // Server-Load und DB-Größe wachsen dadurch nicht mehr über Bot-Traffic.

  // (b) Server-side Referrer capture — DEAKTIVIERT (Feb 2026).
  // Cookies _ssref/_ssrc dienten dem eigenen Live-Analytics-Tracker,
  // der komplett abgestellt wurde. Keine Konsumenten mehr → keine
  // Cookie-Setzung mehr → weniger Set-Cookie-Header-Overhead.

  // (e) Social-Referrer Truth-Klassifikation — DEAKTIVIERT (Feb 2026).
  // Aggregat-Klassifikation ohne exakte Referrer-URLs lieferte für die
  // User-Anforderung ("wo genau auf Facebook") keinen Mehrwert. Modul
  // komplett entfernt inkl. /api/track/social-referrer + /admin/social-referrer.

  return response;
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/debug/llm-version',
    '/api/qa/generate',
    '/api/cron/:path*',
    /*
     * Match all request paths EXCEPT:
     * - _next/static (Next.js build assets)
     * - _next/image (Next.js image optimizer — already CDN-cached)
     * - favicon.ico
     * - api/* (API routes handle their own logic)
     * - img/* (unsere eigenen Image-Handler-Routes serviern statisch)
     * - Alle Static-Asset-Extensions (Bilder, Fonts, CSS, JS, Video, Audio,
     *   robots.txt, sitemap.xml, manifests, IndexNow-Key etc.)
     *
     * Vorher lief Middleware auch auf allen /img/*, .png, .jpg, .webp, .txt,
     * .xml, .woff2 usw. → jeder Static-Hit = 1 Edge Request. Feb 2026-Fix:
     * schmaler Matcher schneidet 60-80 % der Edge Requests weg. Der IndexNow-
     * Key-Verify-File wird durch das explicit-match unten weiter erlaubt
     * (Bing verifiziert die Datei; wir wollen nichts drum herum tun).
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|img/|.*\\.(?:txt|xml|ico|png|jpg|jpeg|gif|webp|avif|svg|css|js|mjs|json|woff|woff2|ttf|eot|otf|mp4|webm|mp3|wav|ogg|zip|pdf|map|webmanifest|php)$).*)',
  ],
};
