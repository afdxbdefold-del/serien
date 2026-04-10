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

  const response = NextResponse.next();

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
  const ua = request.headers.get('user-agent') || '';
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
