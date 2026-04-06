import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INDEXNOW_KEY = '8e6827d79c19f8cbe91089129c21e303';

export function middleware(request: NextRequest) {
  // Serve IndexNow verification file as plain text
  if (request.nextUrl.pathname === `/${INDEXNOW_KEY}.txt`) {
    return new NextResponse(INDEXNOW_KEY, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/8e6827d79c19f8cbe91089129c21e303.txt'],
};
