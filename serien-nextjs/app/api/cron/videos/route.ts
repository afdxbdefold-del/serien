import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { downloadYouTubeTrailer, findTrailerYouTubeId } from '@/lib/trailer-downloader';

const prisma = new PrismaClient();

export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // Verify secret
  if (secret !== 'serien-video-download-2024' && 
      secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Find articles without videos (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const articlesWithoutVideo = await prisma.articles.findMany({
      where: {
        heroVideoUrl: null,
        createdAt: { gte: sevenDaysAgo },
        series: { isNot: null }
      },
      include: {
        series: {
          select: { name: true, trailers: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 3 // Process max 3 per run
    });
    
    console.log(`Found ${articlesWithoutVideo.length} articles without video`);
    
    const results: any[] = [];
    
    for (const article of articlesWithoutVideo) {
      if (!article.series?.trailers) continue;
      
      const trailerId = findTrailerYouTubeId(article.series.trailers);
      if (!trailerId) {
        results.push({ slug: article.slug, status: 'no_trailer_in_tmdb' });
        continue;
      }
      
      console.log(`Downloading trailer for: ${article.slug}`);
      
      try {
        const downloadResult = await downloadYouTubeTrailer(
          trailerId,
          article.series.name || 'video'
        );
        
        if (downloadResult.success && downloadResult.localPath) {
          await prisma.articles.update({
            where: { id: article.id },
            data: { heroVideoUrl: downloadResult.localPath }
          });
          results.push({ 
            slug: article.slug, 
            status: 'success', 
            videoUrl: downloadResult.localPath 
          });
        } else {
          results.push({ 
            slug: article.slug, 
            status: 'download_failed', 
            error: downloadResult.error 
          });
        }
      } catch (error: any) {
        results.push({ 
          slug: article.slug, 
          status: 'error', 
          error: error.message 
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Video cron error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
