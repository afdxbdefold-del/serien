import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_KEY = '8e6827d79c19f8cbe91089129c21e303';
const HOST = 'serien.de';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array required' }, { status: 400 });
    }

    // Max 10,000 URLs per request
    const batch = urls.slice(0, 10000);

    const response = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: batch,
      }),
    });

    const status = response.status;
    const text = await response.text().catch(() => '');

    return NextResponse.json({
      submitted: batch.length,
      status,
      message: status === 200 ? 'Accepted' : status === 202 ? 'Accepted (pending)' : text,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
