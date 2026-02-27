import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const authors = await prisma.users.findMany({
      where: { role: 'author' },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            articles: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Transform to match old API format
    const authorsData = authors.map(author => ({
      user_id: author.id,
      name: author.name,
      email: author.email,
      article_count: author._count.articles,
      avatar_color: getRandomGradient(),
    }));

    return NextResponse.json(authorsData);
  } catch (error) {
    console.error('Failed to fetch authors:', error);
    return NextResponse.json({ error: 'Failed to fetch authors' }, { status: 500 });
  }
}

// Helper function to assign random gradient colors
function getRandomGradient() {
  const gradients = [
    'from-rose-500 to-pink-600',
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-emerald-600',
    'from-red-500 to-rose-600',
    'from-violet-500 to-purple-600',
    'from-pink-500 to-fuchsia-600',
    'from-emerald-500 to-green-600',
    'from-sky-500 to-blue-600',
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
}
