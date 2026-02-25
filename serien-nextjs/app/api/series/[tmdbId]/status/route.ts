/**
 * Series Status API
 * 
 * GET /api/series/[id]/status
 * 
 * Returns current status of a series
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { tmdbId: string } }
) {
  try {
    const seriesId = parseInt(params.tmdbId);

    if (isNaN(seriesId)) {
      return NextResponse.json(
        { error: 'Invalid series ID' },
        { status: 400 }
      );
    }

    const series = await prisma.series.findUnique({
      where: { tmdbId: seriesId },
      select: {
        tmdbId: true,
        name: true,
        currentStatus: true,
        statusDescription: true,
        statusLastUpdate: true,
        lastSeasonNumber: true,
        lastNewsDate: true,
      },
    });

    if (!series) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        seriesId: series.tmdbId,
        seriesName: series.name,
        status: series.currentStatus || 'UNCLEAR',
        description: series.statusDescription || 'Keine Daten verfügbar',
        lastUpdate: series.statusLastUpdate,
        lastSeason: series.lastSeasonNumber,
        lastNewsDate: series.lastNewsDate,
      },
    });

  } catch (error: any) {
    console.error('Series Status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
