import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { downloadYouTubeTrailer, findTrailerYouTubeId } from '@/lib/trailer-downloader';

const prisma = new PrismaClient();

export const maxDuration = 60;

/**
 * Manual video download for a specific article
 * Usage: /api/admin/fix-video?slug=article-slug&secret=serien-video-download-2024
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const slug = searchParams.get('slug');
  const articleId = searchParams.get('id');
  
  if (secret !== 'serien-video-download-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!slug && !articleId) {
    return NextResponse.json({ error: 'slug or id required' }, { status: 400 });
  }
  
  try {
    // Find article
    const article = await prisma.articles.findFirst({
      where: slug ? { slug } : { id: articleId! },
      select: {
        id: true,
        title: true,
        slug: true,
        heroVideoUrl: true,
        primarySeriesId: true,
      }
    });
    
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    
    console.log(`🎬 Manual video fix for: ${article.title}`);
    
    if (article.heroVideoUrl) {
      return NextResponse.json({
        success: true,
        message: 'Article already has video',
        videoUrl: article.heroVideoUrl
      });
    }
    
    if (!article.primarySeriesId) {
      return NextResponse.json({ error: 'Article has no series assigned' }, { status: 400 });
    }
    
    // Get series trailers
    const series = await prisma.series.findUnique({
      where: { tmdbId: article.primarySeriesId },
      select: { name: true, trailers: true }
    });
    
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }
    
    const trailerId = findTrailerYouTubeId(series.trailers);
    
    if (!trailerId) {
      return NextResponse.json({ 
        error: 'No trailer found for series',
        series: series.name,
        trailers: series.trailers
      }, { status: 404 });
    }
    
    console.log(`📥 Downloading trailer ${trailerId} for ${series.name}...`);
    
    // Actually download - this will run for up to 60 seconds
    const downloadResult = await downloadYouTubeTrailer(trailerId, series.name);
    
    if (downloadResult.success && downloadResult.localPath) {
      // Update article
      await prisma.articles.update({
        where: { id: article.id },
        data: { heroVideoUrl: downloadResult.localPath }
      });
      
      console.log(`✅ Video saved: ${downloadResult.localPath}`);
      
      return NextResponse.json({
        success: true,
        message: 'Video downloaded and saved',
        videoUrl: downloadResult.localPath,
        article: article.slug
      });
    } else {
      return NextResponse.json({
        success: false,
        error: downloadResult.error || 'Download failed',
        trailerId,
        series: series.name
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Fix video error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
