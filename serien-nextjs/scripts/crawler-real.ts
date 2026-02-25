import { PrismaClient } from '@prisma/client';
import { searchTv, getTvDetails } from '../lib/tmdb';
import { generateNaturalArticleHTML, validateArticleHTML } from '../lib/article-formatter';

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
    // Step 0: Check if article already exists (Idempotency)
    console.log('\n🔍 Step 0: Checking for existing article...');
    const existingArticle = await tx.article.findUnique({
      where: { sourceUrl: article.url }
    });
    
    if (existingArticle) {
      console.log('⚠️  Article already exists - SKIPPING');
      console.log('   Slug:', existingArticle.slug);
      console.log('   Published:', existingArticle.publishedAt);
      throw new Error('Article already imported');
    }
    
    console.log('✅ Article is new - proceeding with import');

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
const RAW_CONTENT = `
Disney+ hat offiziell die zweite Staffel der Star Wars Spin-off Serie Skeleton Crew verlängert, berichtet The Cinemaholic.
Christopher Ford, Co-Creator der Show, kehrt als Head Writer zurück.
Die Regisseure Daniel Scheinert, Daniel Kwan, David Lowery und Jake Schreier kehren für die neuen Episoden zurück.
Die Dreharbeiten finden in Manhattan Beach, Kalifornien statt.
Die Serie spielt nach den Ereignissen von Return of the Jedi im gleichen Zeitrahmen wie The Mandalorian.
Im Staffel 1 Finale treffen Jod Na Nawood, Fern und Fara auf den mächtigen Supervisor.
Der Supervisor ist ein riesiger Droide der das Volk von At Attin seit Jahren beschützt.
Als Jod den Supervisor mit einem Lichtschwert zerstört wird der gesamte Planet schutzlos.
KB, Neel, Wim und Wendle nutzen Hoverbikes um Fern zu helfen.
Gemeinsam erkennen sie dass der einzige Weg At Attin zu retten darin besteht die Barriere zu zerstören.
Als die Barriere fällt sieht das Volk von At Attin zum ersten Mal die Neue Republik.
Dank KB die Hilfe von SM-33 und Kh'ymm erhielt treffen X-Wings der Neuen Republik ein.
Jods Piraten fliehen in Angst und sein Schiff wird zerstört.
Für Staffel 2 werden folgende Cast-Mitglieder erwartet: Ravi Cabot-Conyers als Wim, Robert Timothy Smith als Neel, Ryan Kiera Armstrong als Fern.
Auch Kyriana Kratter als KB, Nick Frost als SM-33, Kerry Condon als Fara, Tunde Adebimpe als Wendle und Alia Shawkat als Kh'ymm kehren zurück.
Jude Law könnte als Jod Na Nawood zurückkehren der auf Rache aus ist.
`;

const CRAWLED_DATA: CrawledArticle = {
  title: "Star Wars: Skeleton Crew bekommt Staffel 2 bei Disney+",
  url: "https://thecinemaholic.com/skeleton-crew-season-2/",
  seriesName: "Star Wars: Skeleton Crew",
  author: "Shubhabrata Dutta (The Cinemaholic)",
  publishDate: new Date('2026-02-12'),
  category: "Disney+",
  excerpt: "Disney+ hat offiziell die zweite Staffel der Star Wars Spin-off Serie 'Skeleton Crew' bestätigt. Dreharbeiten starten in Manhattan Beach, Kalifornien.",
  content: "" // Will be generated with natural paragraphs
};

async function main() {
  console.log('\n🕷️  Real Crawler with Natural Paragraphs\n');
  console.log('=' .repeat(60));

  // Generate natural paragraph structure
  console.log('📝 Generating natural paragraph structure...');
  try {
    const formattedContent = generateNaturalArticleHTML(
      RAW_CONTENT,
      CRAWLED_DATA.seriesName
    );
    
    // Validate
    const validation = validateArticleHTML(formattedContent);
    if (!validation.valid) {
      console.log('❌ Validation failed:');
      validation.errors.forEach(e => console.log('  - ' + e));
      process.exit(1);
    }
    
    console.log('✅ Article structure validated');
    console.log('  Paragraphs: Natural, scannable format');
    console.log('  Lead: class="lead" applied');
    console.log('  Max sentences per paragraph: 3');
    
    // Set the formatted content
    CRAWLED_DATA.content = formattedContent;
    
  } catch (error: any) {
    console.log('❌ Failed to generate article:', error.message);
    process.exit(1);
  }

  try {
    const result = await processArticleWithTMDB(CRAWLED_DATA);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS! Article with natural paragraphs imported');
    console.log('=' .repeat(60));
    console.log('\n📊 Results:');
    console.log('  Article:', result.article.title);
    console.log('  Slug:', result.article.slug);
    console.log('  Structure: ✅ Natural paragraphs');
    console.log('  Lead paragraph: ✅ Present');
    console.log('  Source:', result.article.sourceUrl);
    console.log('  Author:', CRAWLED_DATA.author);
    
  } catch (error: any) {
    console.log('\n❌ FAILED:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
