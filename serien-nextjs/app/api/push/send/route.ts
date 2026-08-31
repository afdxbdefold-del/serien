import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import webpush from 'web-push';

export const maxDuration = 300;

const PAGE_SIZE = 250;
const SEND_CONCURRENCY = 10;
const MAX_NOTIFICATIONS_PER_RUN = 10_000;
const SEND_TIMEOUT_MS = 10_000;

function errorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === 'number' ? value : null;
}

function optionalString(value: unknown, maxLength: number, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const pushApiSecret = process.env.PUSH_API_SECRET;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!pushApiSecret || !vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: 'Push notifications are not configured' },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${pushApiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    webpush.setVapidDetails(
      'mailto:news@serien.de',
      vapidPublicKey,
      vapidPrivateKey
    );

    const input = await request.json() as {
      title?: unknown;
      body?: unknown;
      url?: unknown;
      image?: unknown;
    };
    const title = optionalString(input.title, 160, '').trim();
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const payload = JSON.stringify({
      title,
      body: optionalString(input.body, 1_000, ''),
      url: optionalString(input.url, 2_048, '/'),
      image: optionalString(input.image, 2_048, '') || null,
      tag: `article-${Date.now()}`
    });

    let successCount = 0;
    let failCount = 0;
    let cleanedCount = 0;
    let processedCount = 0;
    let lastId: string | null = null;
    const snapshotTime = new Date();

    while (processedCount < MAX_NOTIFICATIONS_PER_RUN) {
      const subscriptions = await prisma.push_subscriptions.findMany({
        where: {
          createdAt: { lte: snapshotTime },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: Math.min(PAGE_SIZE, MAX_NOTIFICATIONS_PER_RUN - processedCount),
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      if (subscriptions.length === 0) break;

      const invalidEndpoints: string[] = [];
      for (let offset = 0; offset < subscriptions.length; offset += SEND_CONCURRENCY) {
        const batch = subscriptions.slice(offset, offset + SEND_CONCURRENCY);
        await Promise.all(batch.map(async (sub) => {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            }, payload, {
              TTL: 60 * 60,
              timeout: SEND_TIMEOUT_MS,
            });
            successCount += 1;
          } catch (error: unknown) {
            failCount += 1;
            const statusCode = errorStatusCode(error);
            if (statusCode === 404 || statusCode === 410) {
              invalidEndpoints.push(sub.endpoint);
            }
          }
        }));
      }

      if (invalidEndpoints.length > 0) {
        const deleted = await prisma.push_subscriptions.deleteMany({
          where: { endpoint: { in: invalidEndpoints } },
        });
        cleanedCount += deleted.count;
      }

      processedCount += subscriptions.length;
      lastId = subscriptions.at(-1)?.id ?? null;
      if (subscriptions.length < PAGE_SIZE) break;
    }

    if (processedCount === 0) {
      return NextResponse.json({ message: 'No subscribers', sent: 0 });
    }

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failCount,
      cleaned: cleanedCount,
      truncated: processedCount >= MAX_NOTIFICATIONS_PER_RUN,
    });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}
