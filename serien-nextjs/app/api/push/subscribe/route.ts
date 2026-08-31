import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { isAllowedPushEndpoint, parsePushSubscription } from '@/lib/push-validation';

const MAX_BODY_BYTES = 8 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_WRITES_PER_WINDOW = 25;
const writeBuckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function consumeWriteLimit(request: NextRequest): boolean {
  const now = Date.now();
  if (writeBuckets.size > 5_000) {
    for (const [key, bucket] of writeBuckets) {
      if (bucket.resetAt <= now) writeBuckets.delete(key);
    }
  }

  const key = clientKey(request);
  const current = writeBuckets.get(key);
  if (!current || current.resetAt <= now) {
    writeBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_WRITES_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error('BODY_TOO_LARGE');
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  return JSON.parse(text);
}

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications are not configured' },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}

export async function POST(request: NextRequest) {
  try {
    if (!consumeWriteLimit(request)) {
      return NextResponse.json({ error: 'Too many subscription changes' }, { status: 429 });
    }

    const body = await readJsonBody(request) as { subscription?: unknown };
    const subscription = parsePushSubscription(body.subscription);
    if (!subscription) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Store subscription in database
    await prisma.push_subscriptions.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date()
      },
      create: {
        id: randomUUID(),
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!consumeWriteLimit(request)) {
      return NextResponse.json({ error: 'Too many subscription changes' }, { status: 429 });
    }

    const body = await readJsonBody(request) as { endpoint?: unknown };
    if (!isAllowedPushEndpoint(body.endpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const endpoint = new URL(body.endpoint).toString();

    await prisma.push_subscriptions.delete({
      where: { endpoint }
    }).catch(() => {}); // Ignore if not found

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('Error deleting push subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
