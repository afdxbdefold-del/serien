import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'serien-trends-process-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔥 Starting P3-Trends Pipeline cron job...');
  const startTime = Date.now();

  try {
    // Step 1: Fetch Google Trends
    console.log('\n📊 Step 1: Fetching Google Trends...');
    const { fetchGoogleTrends } = await import('@/scripts/google-trends-scraper');
    const { trends } = await fetchGoogleTrends();
    
    console.log(`   Found ${trends.length} series-related trends`);
    
    if (trends.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No series-related trends found',
        stats: { trendsFound: 0, articlesCreated: 0 },
        timestamp: new Date().toISOString(),
      });
    }

    // Step 2: Get unprocessed trends from DB
    const unprocessedTrends = await prisma.trending_topics.findMany({
      where: { processed: false },
      orderBy: { date: 'desc' },
      take: 3, // Max 3 per run to stay within time limit
    });

    console.log(`\n📝 Step 2: Processing ${unprocessedTrends.length} trends...`);

    // Step 3: Run P3-Trends Pipeline for each
    const { runP3TrendsPipeline } = await import('@/scripts/p3-trends');
    const results = [];

    for (const trend of unprocessedTrends) {
      console.log(`\n   Processing: "${trend.query}"`);
      
      try {
        const result = await runP3TrendsPipeline(trend.id, trend.query);
        results.push(result);
        
        if (result.success) {
          console.log(`   ✅ Article created: ${result.slug}`);
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        results.push({ success: false, trendId: trend.id, error: error.message });
      }

      // Small delay between articles
      await new Promise(r => setTimeout(r, 1000));
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const successCount = results.filter(r => r.success).length;

    console.log(`\n✅ Cron job complete in ${duration}s`);
    console.log(`   Trends found: ${trends.length}`);
    console.log(`   Articles created: ${successCount}/${unprocessedTrends.length}`);

    return NextResponse.json({
      success: true,
      stats: {
        trendsFound: trends.length,
        trendsProcessed: unprocessedTrends.length,
        articlesCreated: successCount,
        duration: `${duration}s`,
      },
      results: results.map(r => ({
        trendId: r.trendId,
        success: r.success,
        slug: r.slug,
        error: r.error,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Trends cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
