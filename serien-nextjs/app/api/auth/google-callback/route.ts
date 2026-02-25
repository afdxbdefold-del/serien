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
    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json(
        { detail: 'session_id ist erforderlich' },
        { status: 400 }
      );
    }

    // Exchange session_id for user data from Emergent Auth
    const response = await fetch(
      'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
      {
        headers: {
          'X-Session-ID': session_id,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { detail: 'Ungültige Session-ID' },
        { status: 401 }
      );
    }

    const userData = await response.json();
    const { email, name, picture } = userData;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user from Google OAuth
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          image: picture,
          role: 'user',
          password: null, // OAuth users don't have passwords
        },
      });
    } else {
      // Update existing user's image if changed
      if (picture && user.image !== picture) {
        user = await prisma.user.update({
          where: { email },
          data: { image: picture },
        });
      }
    }

    // Create JWT token
    const token = await new SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(getJWTSecret());

    // Create response
    const res = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
    });

    // Set cookie
    res.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.json(
      { detail: 'OAuth-Authentifizierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
