import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/articles/[slug]/comments - Get all comments for an article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    const article = await prisma.article.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const comments = await prisma.comment.findMany({
      where: {
        articleId: article.id,
        parentId: null, // Only top-level comments
        status: 'approved'
      },
      include: {
        user: {
          select: {
            name: true,
            image: true
          }
        },
        replies: {
          where: { status: 'approved' },
          include: {
            user: {
              select: {
                name: true,
                image: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/articles/[slug]/comments - Add a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    // Get authenticated user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Bitte melden Sie sich an, um zu kommentieren' },
        { status: 401 }
      );
    }

    const article = await prisma.article.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const { content, parentId } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const comment = await prisma.comment.create({
      data: {
        articleId: article.id,
        userId: user.id,
        content: content.trim(),
        parentId: parentId || null,
        status: 'approved' // Auto-approve for now
      },
      include: {
        user: {
          select: {
            name: true,
            image: true
          }
        }
      }
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
