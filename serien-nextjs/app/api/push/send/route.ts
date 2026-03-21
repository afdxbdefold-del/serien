import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEBeEvAM1m98ZaK8sLKrQKjMLEDLf6WV0sWgc6RK8tw3ULZvXaGtM3SA2eJ__xAMOM6YrTW_azmHbBkxLnkpB6U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'ZlxvJDUGhJI--NTiJoDnH-1f50Ink_SmNqi-pK6GzIo';

webpush.setVapidDetails(
  'mailto:news@serien.de',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - in production use proper admin auth
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.PUSH_API_SECRET || 'serien-push-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, body, url, image } = await request.json();
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get all subscriptions
    const subscriptions = await prisma.pushSubscription.findMany();
    
    if (subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscribers', sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: body || '',
      url: url || '/',
      image: image || null,
      tag: `article-${Date.now()}`
    });

    let successCount = 0;
    let failCount = 0;
    const failedEndpoints: string[] = [];

    // Send to all subscribers
    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, payload);
        successCount++;
      } catch (error: any) {
        failCount++;
        // Remove invalid subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    }));

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: failedEndpoints } }
      });
    }

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failCount,
      cleaned: failedEndpoints.length
    });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}
