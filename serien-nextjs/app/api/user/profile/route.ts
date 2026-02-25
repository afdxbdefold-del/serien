import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // Get user with follow and article counts
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        _count: {
          select: {
            follows: true,
            comments: true,
            articles: true,
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json(
        { detail: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      image: userData.image,
      createdAt: userData.createdAt,
      stats: {
        followedSeries: userData._count.follows,
        comments: userData._count.comments,
        articles: userData._count.articles,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Abrufen des Profils' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const { name, image } = await request.json();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && { name }),
        ...(image && { image }),
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      image: updatedUser.image,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Aktualisieren des Profils' },
      { status: 500 }
    );
  }
}
