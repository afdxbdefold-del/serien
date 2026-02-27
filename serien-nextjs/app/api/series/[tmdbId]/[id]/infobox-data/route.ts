/**
 * API Route: Series Infobox Data
 * Returns minimal, scannable data for the Discover-optimized infobox
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const seriesId = parseInt(id);

  if (isNaN(seriesId)) {
    return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
  }

  try {
    const series = await prisma.series.findUnique({
      where: { tmdbId: seriesId },
      select: {
        status: true,
        numberOfSeasons: true,
        genres: true,
        networks: true,
        posterPath: true,
      },
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // Format status
    const statusMap: Record<string, string> = {
      'Returning Series': 'Läuft',
      'Ended': 'Abgeschlossen',
      'Canceled': 'Abgesetzt',
      'In Production': 'In Produktion',
      'Planned': 'Geplant',
    };
    const status = statusMap[series.status] || series.status;

    // Get primary genre
    const genre = series.genres && series.genres.length > 0 
      ? series.genres[0] 
      : null;

    // Get primary platform
    const platform = series.networks && series.networks.length > 0
      ? series.networks[0]
      : null;

    return NextResponse.json({
      status,
      numberOfSeasons: series.numberOfSeasons || 0,
      genre,
      platform,
      posterPath: series.posterPath,
    });

  } catch (error) {
    console.error('Series infobox data fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
