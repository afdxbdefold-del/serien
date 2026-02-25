import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SignJWT } from 'jose';

function getJWTSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { detail: 'Session ID ist erforderlich' },
        { status: 400 }
      );
    }

    // Fetch user data from Emergent Auth
    const authResponse = await fetch(
      `https://auth.emergentagent.com/api/session/${sessionId}`
    );

    if (!authResponse.ok) {
      return NextResponse.json(
        { detail: 'Ungültige Session' },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();
    const { email, name, picture } = authData;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          image: picture,
          role: 'user',
        },
      });
    } else if (picture && user.image !== picture) {
      // Update image if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: { image: picture },
      });
    }

    // Create JWT token
    const token = await new SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    // Create response
    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
    });

    // Set cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Google session error:', error);
    return NextResponse.json(
      { detail: 'Google-Anmeldung fehlgeschlagen' },
      { status: 500 }
    );
  }
}