import { PrismaClient } from '@prisma/client';
import { searchTv, getTvDetails } from '../lib/tmdb';

const prisma = new PrismaClient();

interface NewsArticle {
  title: string;
  url: string;
  content: string;
  excerpt: string;
  publishDate: Date;
  category: string;
  seriesName: string;  // Required for TMDB matching
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function processArticleWithTMDB(article: NewsArticle) {
  console.log('\n🚀 Processing:', article.title);
  console.log('📺 Series:', article.seriesName);

  return await prisma.$transaction(async (tx) => {
    // Step A: Determine tmdbId
    console.log('\n🔍 Step A: Searching TMDB...');
    const searchResult = await searchTv(article.seriesName, 'de-DE');
    
    if (!searchResult) {
      console.log('❌ No TMDB match found - SKIPPING');
      throw new Error('No TMDB match found');
    }

    console.log('✅ Found:', searchResult.name);
    console.log('📊 Confidence:', (searchResult.confidence * 100).toFixed(1) + '%');

    if (searchResult.confidence < 0.75) {
      console.log('⚠️  Confidence too low (<75%) - SKIPPING');
      throw new Error(`Low confidence: ${searchResult.confidence}`);
    }

    const tmdbId = searchResult.tmdbId;

    // Step B: Ensure Series exists (UPSERT)
    console.log('\n📚 Step B: Upserting Series...');
    const details = await getTvDetails(tmdbId, 'de-DE');
    
    if (!details) {
      console.log('⚠️  Could not fetch full details - using search data');
    }

    const seriesSlug = generateSlug(searchResult.name || article.seriesName);
    
    const series = await tx.series.upsert({
      where: { tmdbId },
      update: {
        name: details?.name || searchResult.name,
        originalName: details?.original_name || searchResult.originalName,
        overview: details?.overview || searchResult.overview,
        posterPath: details?.poster_path || searchResult.posterPath,
        backdropPath: details?.backdrop_path || searchResult.backdropPath,
        status: details?.status,
        firstAirDate: details?.first_air_date ? new Date(details.first_air_date) : searchResult.firstAirDate ? new Date(searchResult.firstAirDate) : null,
        genresJson: details?.genres || null,
        networksJson: details?.networks || null,
        updatedAt: new Date(),
      },
      create: {
        tmdbId,
        tmdbType: 'tv',
        title: searchResult.name || article.seriesName,
        slug: seriesSlug,
        name: details?.name || searchResult.name,
        originalName: details?.original_name || searchResult.originalName,
        overview: details?.overview || searchResult.overview,
        posterPath: details?.poster_path || searchResult.posterPath,
        backdropPath: details?.backdrop_path || searchResult.backdropPath,
        status: details?.status,
        firstAirDate: details?.first_air_date ? new Date(details.first_air_date) : searchResult.firstAirDate ? new Date(searchResult.firstAirDate) : null,
        genres: details?.genres?.map(g => g.name) || [],
        genresJson: details?.genres || null,
        networks: details?.networks?.map(n => n.name) || [],
        networksJson: details?.networks || null,
      },
    });

    console.log('✅ Series upserted:', series.tmdbId);

    // Step C: ALWAYS import TMDB image paths
    console.log('\n🖼️  Step C: Generating image URLs...');
    const imageData = {
      tmdbId,
      tmdbType: 'tv' as const,
      tmdbPosterPath: series.posterPath,
      tmdbBackdropPath: series.backdropPath,
      heroImageUrl: `/img/hero/tv/${tmdbId}`,
      ogImageUrl: `/img/og/tv/${tmdbId}`,
      cardImageUrl: `/img/card/tv/${tmdbId}`,
      imageAttribution: 'TMDB',
    };

    console.log('✅ Image URLs generated');

    // Step D: Create Article linked to Series
    console.log('\n📄 Step D: Creating Article...');
    const slug = generateSlug(article.title);
    
    // Get or create author
    const author = await tx.user.upsert({
      where: { email: 'crawler@serien.de' },
      update: {},
      create: {
        id: 'news-crawler-bot',
        email: 'crawler@serien.de',
        name: 'News Crawler',
        role: 'author',
      },
    });

    const articleData = await tx.article.create({
      data: {
        id: `crawler-${Date.now()}`,
        slug,
        title: article.title,
        excerpt: article.excerpt,
        contentHtml: article.content,
        authorId: author.id,
        status: 'published',
        publishedAt: article.publishDate,
        category: article.category,
        readingTime: Math.ceil(article.content.split(' ').length / 200),
        sourceUrl: article.url,
        confidence: searchResult.confidence,
        tmdbSeriesId: series.tmdbId,  // Link to series
        ...imageData,
      },
    });

    console.log('✅ Article created:', articleData.slug);
    
    return {
      article: articleData,
      series,
      confidence: searchResult.confidence,
    };
  });
}

async function crawlAndImport() {
  console.log('\n🕷️  TMDB Auto-Import Crawler Started\n');
  console.log('=' .repeat(60));

  // Example news article
  const article: NewsArticle = {
    title: "The Last of Us Staffel 2: Starttermin für 2025 bestätigt",
    url: "https://example.com/last-of-us-season-2",
    seriesName: "The Last of Us",  // CRITICAL for TMDB matching
    excerpt: "HBO bestätigt offiziell den Starttermin für die zweite Staffel der erfolgreichen Post-Apokalypse-Serie The Last of Us.",
    content: `
      <p>HBO hat endlich den lang erwarteten Starttermin für die zweite Staffel von "The Last of Us" bekanntgegeben. Die Serie, basierend auf dem gleichnamigen Videospiel, wird im Frühjahr 2025 zurückkehren.</p>
      
      <p>Nach dem enormen Erfolg der ersten Staffel, die sowohl Kritiker als auch Fans begeisterte, waren die Erwartungen hoch. Die zweite Staffel wird die Geschichte von Joel und Ellie fortsetzen und tiefere Einblicke in die post-apokalyptische Welt geben.</p>
      
      <p>Die Produktion begann im vergangenen Jahr in Kanada, und erste Bilder vom Set zeigen eine noch düsterere und intensivere Atmosphäre als in der ersten Staffel.</p>
      
      <p><strong>Quelle:</strong> HBO Press Release</p>
    `,
    publishDate: new Date('2026-02-25'),
    category: 'HBO',
  };

  try {
    const result = await processArticleWithTMDB(article);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS! Article imported with full TMDB integration');
    console.log('=' .repeat(60));
    console.log('\n📊 Results:');
    console.log('  Article Slug:', result.article.slug);
    console.log('  Series TMDB ID:', result.series.tmdbId);
    console.log('  Series Name:', result.series.name);
    console.log('  Match Confidence:', (result.confidence * 100).toFixed(1) + '%');
    console.log('  Hero Image:', result.article.heroImageUrl);
    console.log('  OG Image:', result.article.ogImageUrl);
    console.log('  Card Image:', result.article.cardImageUrl);
    console.log('\n🔗 URLs:');
    console.log('  Article:', `/${result.article.slug}`);
    console.log('  Series:', `/serie/${result.series.tmdbId}-${result.series.slug}`);
    
  } catch (error: any) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ FAILED:', error.message);
    console.log('=' .repeat(60));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

crawlAndImport()
  .then(() => {
    console.log('\n✅ Crawler completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Crawler error:', error);
    process.exit(1);
  });
