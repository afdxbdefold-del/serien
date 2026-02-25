import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

// Simple hardcoded admin credentials (replace with database in production)
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { detail: 'Username und Passwort sind erforderlich' },
        { status: 400 }
      );
    }

    // Validate credentials
    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      return NextResponse.json(
        { detail: 'Ungültige Anmeldedaten' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({ username, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    return NextResponse.json({
      token,
      username,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { detail: 'Anmeldung fehlgeschlagen' },
      { status: 500 }
    );
  }
}