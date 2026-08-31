import { NextResponse } from 'next/server';

type RequestWithHeaders = Pick<Request, 'headers'>;

/** Authenticate cache-invalidation calls with a dedicated server secret. */
export function requireInternalAuth(request: RequestWithHeaders): NextResponse | null {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: 'Internal revalidation is not configured' },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
