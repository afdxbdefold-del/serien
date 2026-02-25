import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      const response = NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
      response.headers.set('Cache-Control', 'no-store, must-revalidate');
      return response;
    }

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
    });
    
    // Prevent caching of auth state
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
    
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { detail: 'Fehler beim Abrufen der Benutzerdaten' },
      { status: 500 }
    );
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
    return response;
  }
}
