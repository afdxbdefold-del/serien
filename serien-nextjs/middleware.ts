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
