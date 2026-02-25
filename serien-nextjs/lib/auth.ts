import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export async function getCurrentUser(request: NextRequest) {
  try {
    // Try to get token from cookie
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return null;
    }

    // Verify token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (!payload.userId) {
      return null;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string }
    });

    return user;
  } catch (error) {
    return null;
  }
}

export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}