import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from './prisma';

function getJWTSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function getCurrentUser(request: NextRequest) {
  try {
    // Try to get token from cookie
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return null;
    }

    // Verify token
    const { payload } = await jwtVerify(token, getJWTSecret());
    
    if (!payload.userId) {
      return null;
    }

    // Get user from database
    const user = await prisma.users.findUnique({
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