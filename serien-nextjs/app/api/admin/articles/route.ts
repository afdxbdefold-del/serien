import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jwtVerify } from 'jose';

function getJWTSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, getJWTSecret());
    return payload;
  } catch {
    return null;
  }
}

// GET - List articles with pagination and filtering
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const contentType = searchParams.get('contentType') || '';
  const status = searchParams.get('status') || '';

  const where: any = {};
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (contentType) {
    where.contentType = contentType;
  }
  
  if (status) {
    where.status = status;
  }

  try {
    const [articles, total] = await Promise.all([
      prisma.articles.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          contentType: true,
          publishedAt: true,
          createdAt: true,
          users: {
            select: { name: true }
          },
          series: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: page * limit,
        take: limit,
      }),
      prisma.articles.count({ where }),
    ]);

    return NextResponse.json({
      articles: articles.map(a => ({
        ...a,
        authorName: a.users?.name || 'Unbekannt',
        seriesName: a.series?.name || null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

// DELETE - Delete an article
export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Support both query param and body
  const { searchParams } = new URL(request.url);
  let id = searchParams.get('id');
  
  if (!id) {
    try {
      const body = await request.json();
      id = body.articleId || body.id;
    } catch {
      // No body
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'Article ID required' }, { status: 400 });
  }

  try {
    // Check if article exists
    const article = await prisma.articles.findUnique({
      where: { id },
      select: { title: true, slug: true }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Delete related data first (discover scores, qa, etc.)
    await prisma.discover_score_dashboards.deleteMany({
      where: { articleId: id }
    }).catch(() => {});
    
    await prisma.qa_schemas.deleteMany({
      where: { articleId: id }
    }).catch(() => {});

    // Delete the article
    await prisma.articles.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Artikel "${article.title}" gelöscht`,
      slug: article.slug
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
