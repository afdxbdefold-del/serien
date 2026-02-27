import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkArticle() {
  try {
    const article = await prisma.articles.findUnique({
      where: { slug: 'die-wahre-geschichte-von-the-gray-house-erklaert' },
      include: {
        series: true,
        article_qa: true,
      }
    });
    
    if (!article) {
      console.log('❌ Article not found');
      return;
    }
    
    console.log('=== GRAY HOUSE ARTICLE DATA ===');
    console.log('Title:', article.title);
    console.log('Slug:', article.slug);
    console.log('primarySeriesId:', article.primarySeriesId);
    console.log('primarySeries (series) exists:', !!article.series);
    if (article.series) {
      console.log('  - Series name:', article.series.name || article.series.title);
      console.log('  - Series slug:', article.series.slug);
      console.log('  - Series tmdbId:', article.series.tmdbId);
      console.log('  - Series networks:', article.series.networks);
    }
    console.log('article_qa exists:', !!article.article_qa);
    if (article.article_qa) {
      const questions = article.article_qa.questions;
      console.log('  - Questions count:', Array.isArray(questions) ? questions.length : 'N/A');
      if (Array.isArray(questions)) {
        questions.slice(0, 3).forEach((q, i) => {
          console.log(`  - Q${i+1}:`, q.question || 'N/A');
        });
      }
    }
    console.log('================================');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticle();
