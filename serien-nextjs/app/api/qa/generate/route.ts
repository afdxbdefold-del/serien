/**
 * API Route: Generate Q&A for Articles
 * POST /api/qa/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateArticleQA } from '@/lib/qa-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: 'articleId required' },
        { status: 400 }
      );
    }

    // Fetch article
    const article = await prisma.articles.findUnique({
      where: { id: articleId },
      include: {
        series: true, // Fixed: use 'series' not 'primarySeries'
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    console.log(`🤔 Generating Q&A for article: ${article.title}`);

    // Generate Q&A
    const questions = await generateArticleQA({
      title: article.title,
      contentHtml: article.contentHtml,
      seriesName: article.series?.title || article.series?.name || 'Unknown',
      seriesStatus: article.series?.status || undefined,
    });

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'Q&A generation failed' },
        { status: 500 }
      );
    }

    // Check if Q&A already exists
    const existing = await prisma.article_qa.findUnique({
      where: { articleId },
    });

    let result;
    if (existing) {
      // Update
      result = await prisma.article_qa.update({
        where: { articleId },
        data: {
          questions: questions,
          schemaEnabled: questions.every((q) => q.factual),
          updatedAt: new Date(),
        },
      });
      console.log(`✅ Q&A updated: ${questions.length} questions`);
    } else {
      // Create
      result = await prisma.article_qa.create({
        data: {
          articleId,
          questions: questions,
          schemaEnabled: questions.every((q) => q.factual),
        },
      });
      console.log(`✅ Q&A created: ${questions.length} questions`);
    }

    return NextResponse.json({
      success: true,
      qaId: result.id,
      questionCount: questions.length,
      schemaEnabled: result.schemaEnabled,
    });

  } catch (error: any) {
    console.error('❌ Q&A API error:', error);
    return NextResponse.json(
      { error: 'Q&A generation failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');

    if (!articleId) {
      return NextResponse.json(
        { error: 'articleId required' },
        { status: 400 }
      );
    }

    const qa = await prisma.articleQA.findUnique({
      where: { articleId },
    });

    if (!qa) {
      return NextResponse.json(
        { error: 'Q&A not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(qa);

  } catch (error: any) {
    console.error('❌ Q&A GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Q&A' },
      { status: 500 }
    );
  }
}
