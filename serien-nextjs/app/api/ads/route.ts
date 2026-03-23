import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse(
    'google.com, pub-8583619451045805, DIRECT, f08c47fec0942fa0\n',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    }
  );
}
