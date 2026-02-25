import { PrismaClient } from '@prisma/client';
import { searchTv, getTvDetails } from '../lib/tmdb';

const prisma = new PrismaClient();

interface CrawledArticle {
  title: string;
  url: string;
  content: string;
  excerpt: string;
  author: string;
  publishDate: Date;
  category: string;
  seriesName: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function processArticleWithTMDB(article: CrawledArticle) {
  console.log('\n🚀 Processing:', article.title);
  console.log('📺 Series:', article.seriesName);
  console.log('✍️  Author:', article.author);

  return await prisma.$transaction(async (tx) => {
    // Step A: TMDB Search
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

    // Step B: Series UPSERT
    console.log('\n📚 Step B: Upserting Series...');
    const details = await getTvDetails(tmdbId, 'de-DE');
    
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
        firstAirDate: details?.first_air_date ? new Date(details.first_air_date) : null,
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
        firstAirDate: details?.first_air_date ? new Date(details.first_air_date) : null,
        genres: details?.genres?.map(g => g.name) || [],
        genresJson: details?.genres || null,
        networks: details?.networks?.map(n => n.name) || [],
        networksJson: details?.networks || null,
      },
    });

    console.log('✅ Series upserted:', series.tmdbId);

    // Step C: Image URLs
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

    // Step D: Create Article
    console.log('\n📄 Step D: Creating Article...');
    const slug = generateSlug(article.title);
    
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
        tmdbSeriesId: series.tmdbId,
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

// ECHTE CRAWLED DATA von CinemaHolic
const CRAWLED_DATA: CrawledArticle = {
  title: "Star Wars: Skeleton Crew bekommt Staffel 2 bei Disney+",
  url: "https://thecinemaholic.com/skeleton-crew-season-2/",
  seriesName: "Star Wars: Skeleton Crew",
  author: "Shubhabrata Dutta (The Cinemaholic)",
  publishDate: new Date('2026-02-12'),
  category: "Disney+",
  excerpt: "Disney+ hat offiziell die zweite Staffel der Star Wars Spin-off Serie 'Skeleton Crew' bestätigt. Dreharbeiten starten in Manhattan Beach, Kalifornien.",
  content: `
    <p>Disney+ hat offiziell die zweite Staffel der Star Wars Spin-off Serie "Skeleton Crew" verlängert, berichtet The Cinemaholic. Christopher Ford, Co-Creator der Show, kehrt als Head Writer zurück, zusammen mit den Regisseuren Daniel Scheinert & Daniel Kwan (die Daniels), David Lowery und Jake Schreier für die neuen Episoden.</p>
    
    <p>Die Dreharbeiten finden in Manhattan Beach, Kalifornien statt. Die Serie spielt nach den Ereignissen von "Return of the Jedi" im gleichen Zeitrahmen wie "The Mandalorian".</p>
    
    <p>Im Staffel 1 Finale (Episode 8 "The Real Good Guys") treffen Jod Na Nawood, Fern und Fara auf den mächtigen Supervisor - einen riesigen Droiden, der das Volk von At Attin seit Jahren beschützt. Als Jod den Supervisor mit einem Lichtschwert zerstört, wird der Planet schutzlos.</p>
    
    <p>KB, Neel, Wim und Wendle nutzen Hoverbikes um Fern zu helfen. Gemeinsam erkennen sie, dass der einzige Weg At Attin zu retten darin besteht, die Barriere zu zerstören und den Planeten der Galaxis zu offenbaren. Als die Neue Republik eintrifft, fliehen Jods Piraten und er wird besiegt.</p>
    
    <p>Für Staffel 2 werden folgende Cast-Mitglieder erwartet: Ravi Cabot-Conyers als Wim, Robert Timothy Smith als Neel, Ryan Kiera Armstrong als Fern, Kyriana Kratter als KB, Nick Frost als SM-33, Kerry Condon als Fara, Tunde Adebimpe als Wendle und Alia Shawkat als Kh'ymm. Jude Law könnte als Jod Na Nawood zurückkehren.</p>
    
    <p><strong>Quelle:</strong> The Cinemaholic</p>
  `
};

async function main() {
  console.log('\n🕷️  Real Crawler Started - CinemaHolic\n');
  console.log('=' .repeat(60));

  // PLACEHOLDER - wird durch echte Crawl-Daten ersetzt
  if (!CRAWLED_DATA.title) {
    console.log('❌ No crawled data provided');
    process.exit(1);
  }

  try {
    const result = await processArticleWithTMDB(CRAWLED_DATA);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS! Real article imported from CinemaHolic');
    console.log('=' .repeat(60));
    console.log('\n📊 Results:');
    console.log('  Article:', result.article.title);
    console.log('  Slug:', result.article.slug);
    console.log('  Source:', result.article.sourceUrl);
    console.log('  Author:', CRAWLED_DATA.author);
    console.log('  Series:', result.series.name);
    console.log('  Confidence:', (result.confidence * 100).toFixed(1) + '%');
    
  } catch (error: any) {
    console.log('\n❌ FAILED:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
