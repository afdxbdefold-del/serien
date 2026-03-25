import { NextRequest, NextResponse } from 'next/server';
import { processTrendingTopics } from '@/scripts/trends-processor';

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'serien-trends-process-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔥 Starting trends processing cron job...');

  try {
    const stats = await processTrendingTopics({
      maxTrends: 5,
      maxArticlesPerTrend: 2,
      dryRun: false,
    });

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Trends cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
