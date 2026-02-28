import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const { streamers, seriesIds } = await request.json();

    // Update user with streamers and onboarding complete
    await prisma.users.update({
      where: { id: user.id },
      data: {
        favoriteStreamers: streamers || [],
        onboardingCompleted: true,
      },
    });

    // Create follows for selected series
    if (seriesIds && seriesIds.length > 0) {
      const followsData = seriesIds.map((tmdbId: number) => ({
        userId: user.id,
        tmdbSeriesId: tmdbId,
      }));

      // Use createMany with skipDuplicates to avoid conflicts
      await prisma.follows.createMany({
        data: followsData,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Speichern der Einstellungen' },
      { status: 500 }
    );
  }
}
