import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Temporärer Debug-Endpoint: zeigt alle Request-Header + relevante Geo-Werte.
// Wird nach Diagnose wieder gelöscht.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const h: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    h[key] = value;
  });

  return NextResponse.json(
    {
      geo: {
        'cf-ipcountry': request.headers.get('cf-ipcountry'),
        'cf-ipcity': request.headers.get('cf-ipcity'),
        'cf-region': request.headers.get('cf-region'),
        'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
        'cf-ray': request.headers.get('cf-ray'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
        'x-real-ip': request.headers.get('x-real-ip'),
      },
      all: h,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
