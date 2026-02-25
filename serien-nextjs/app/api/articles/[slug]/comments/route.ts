import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

// GET /api/articles/[slug]/comments - Get all comments for an article
export async function GET(
  request: Request,
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
      where: {
        articleId: article.id,
        parentId: null, // Only top-level comments
        status: 'approved'
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
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    const { slug } = await params;
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
        status: 'approved' // Auto-approve for now, can add moderation later
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
