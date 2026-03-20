/**
 * Create articles directly from TMDB series data
 * Usage: npx tsx scripts/create-from-tmdb.ts <tmdbId> [<tmdbId2> ...]
 */

import { PrismaClient } from '@prisma/client';
import { getTvDetailsComplete } from '../lib/tmdb';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { markdownToHtml } from '../lib/markdown-to-html';
import { importSeriesCharacters } from './import-characters';
import { importSeriesCast } from '../lib/cast-importer';
import { linkCharactersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';
import { findTrailerYouTubeId, downloadYouTubeTrailer } from '../lib/trailer-downloader';
import { extractFacts } from '../lib/fact-extractor';

const prisma = new PrismaClient();

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getOrCreateSeries(tmdbId: number, details: any) {
  let series = await prisma.series.findFirst({
    where: { tmdbId }
  });

  if (!series) {
    console.log(`  📺 Creating series: ${details.name}`);
    series = await prisma.series.create({
      data: {
        tmdbId: tmdbId,
        title: details.name,
        name: details.name,
        slug: generateSlug(details.name),
        overview: details.overview || null,
        posterPath: details.poster_path || null,
        backdropPath: details.backdrop_path || null,
        status: details.status || null,
        firstAirDate: details.first_air_date ? new Date(details.first_air_date) : null,
        genres: details.genres?.map((g: any) => g.name) || [],
        networks: details.networks?.map((n: any) => n.name) || [],
        numberOfSeasons: details.number_of_seasons || null,
        numberOfEpisodes: details.number_of_episodes || null,
        updatedAt: new Date(),
      }
    });
  }

  return series;
}

async function createArticleFromTMDB(tmdbId: number): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log(`🎬 CREATING ARTICLE FOR TMDB ID: ${tmdbId}`);
  console.log('='.repeat(70));

  // 1. Fetch TMDB details
  console.log('\n📡 Fetching TMDB details...');
  const details = await getTvDetailsComplete(tmdbId, 'de-DE');
  
  if (!details) {
    throw new Error(`Could not fetch TMDB details for ID ${tmdbId}`);
  }

  console.log(`  ✅ Found: ${details.name} (${details.first_air_date?.slice(0, 4) || 'N/A'})`);

  // 2. Get or create series
  const series = await getOrCreateSeries(tmdbId, details);
  console.log(`  ✅ Series ID: ${series.id}`);

  // 3. Import characters and cast
  console.log('\n👥 Importing characters and cast...');
  try {
    await importSeriesCharacters(series.id);
    console.log('  ✅ Characters imported');
  } catch (e) {
    console.log('  ⚠️ Character import skipped:', (e as Error).message);
  }

  try {
    await importSeriesCast(series.id);
    console.log('  ✅ Cast imported');
  } catch (e) {
    console.log('  ⚠️ Cast import skipped:', (e as Error).message);
  }

  // 4. Build source text from TMDB data
  const sourceText = buildSourceText(details);
  console.log(`  📝 Source text: ${sourceText.length} characters`);

  // 5. Extract facts from source text
  console.log('\n📊 Extracting facts...');
  const facts = await extractFacts(sourceText, `${details.name}: Alles was du wissen musst`);
  console.log(`  ✅ Extracted facts`);

  // 6. Generate article content
  console.log('\n🤖 Generating article content...');
  const articleTitle = `${details.name}: Alles was du wissen musst`;
  
  const structuredContent = await generateStructuredContent({
    facts,
    seriesName: details.name,
    originalHeadline: articleTitle,
    sourceText: sourceText,
    contentType: 'NEWS',
    wordCountTarget: 500,
  });

  console.log(`  ✅ Headline: ${structuredContent.headline}`);
  console.log(`  ✅ Sections: ${structuredContent.sections?.length || 0}`);

  // 7. Link characters and cast
  console.log('\n🔗 Linking characters and cast...');
  let contentWithLinks = structuredContent.markdown;
  
  try {
    const charResult = await linkCharactersInMarkdown(contentWithLinks, series.tmdbId);
    contentWithLinks = charResult.linkedMarkdown;
    console.log(`  ✅ ${charResult.charactersLinked} characters linked`);
  } catch (e) {
    console.log('  ⚠️ Character linking skipped');
  }

  try {
    const castResult = await linkCastInMarkdown(contentWithLinks, series.tmdbId);
    contentWithLinks = castResult.linkedMarkdown;
    console.log(`  ✅ ${castResult.actorsLinked} cast linked`);
  } catch (e) {
    console.log('  ⚠️ Cast linking skipped');
  }

  // 8. Convert to HTML
  console.log('\n📄 Converting to HTML...');
  const contentHtml = await markdownToHtml(contentWithLinks);

  // 9. Find trailer
  console.log('\n🎬 Finding trailer...');
  let trailerLocalUrl: string | null = null;
  let heroVideoUrl: string | null = null;
  
  try {
    const trailerYouTubeId = await findTrailerYouTubeId(tmdbId, 'tv', details.name);
    if (trailerYouTubeId) {
      console.log(`  ✅ Found trailer: ${trailerYouTubeId}`);
      trailerLocalUrl = await downloadYouTubeTrailer(trailerYouTubeId, generateSlug(details.name));
      if (!trailerLocalUrl) {
        heroVideoUrl = `https://www.youtube.com/watch?v=${trailerYouTubeId}`;
      }
    } else {
      console.log('  ⚠️ No trailer found');
    }
  } catch (e) {
    console.log('  ⚠️ Trailer search failed:', (e as Error).message);
  }

  // 10. Select author
  const authors = await prisma.users.findMany({
    where: { role: { in: ['author', 'admin'] } },
    select: { id: true }
  });
  const randomAuthor = authors[Math.floor(Math.random() * authors.length)];

  // 11. Create article
  console.log('\n💾 Saving article...');
  const slug = generateSlug(structuredContent.headline);
  
  // Check if article already exists
  const existingArticle = await prisma.articles.findUnique({
    where: { slug }
  });

  if (existingArticle) {
    console.log(`  ⚠️ Article with slug "${slug}" already exists. Skipping.`);
    return;
  }

  // Generate unique ID
  const articleId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const article = await prisma.articles.create({
    data: {
      id: articleId,
      title: structuredContent.headline,
      slug,
      excerpt: structuredContent.metaDescription,
      contentHtml,
      heroImageUrl: details.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
        : details.poster_path
          ? `https://image.tmdb.org/t/p/original${details.poster_path}`
          : null,
      trailerLocalUrl,
      heroVideoUrl,
      tmdbId,
      tmdbType: 'tv',
      contentType: 'GENERATED',
      status: 'published',
      authorId: randomAuthor?.id || 'cmm26siwx0000nv4u4zbv0iwy', // Default admin
      primarySeriesId: series.tmdbId,
      metaDescription: structuredContent.metaDescription,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('🎉 ARTICLE CREATED SUCCESSFULLY');
  console.log('='.repeat(70));
  console.log(`  📰 Title: ${article.title}`);
  console.log(`  🔗 Slug: ${article.slug}`);
  console.log(`  📺 Series: ${series.name}`);
  console.log(`  🆔 Article ID: ${article.id}`);
  console.log('='.repeat(70));
}

function buildSourceText(details: any): string {
  const parts: string[] = [];

  // Overview
  if (details.overview) {
    parts.push(`Beschreibung: ${details.overview}`);
  }

  // Status
  if (details.status) {
    const statusMap: Record<string, string> = {
      'Returning Series': 'Die Serie läuft noch und wird fortgesetzt.',
      'Ended': 'Die Serie ist abgeschlossen.',
      'Canceled': 'Die Serie wurde abgesetzt.',
      'In Production': 'Die Serie befindet sich in Produktion.',
    };
    parts.push(`Status: ${statusMap[details.status] || details.status}`);
  }

  // Seasons & Episodes
  if (details.number_of_seasons) {
    parts.push(`Die Serie hat ${details.number_of_seasons} Staffeln mit insgesamt ${details.number_of_episodes || 'mehreren'} Episoden.`);
  }

  // Genres
  if (details.genres?.length) {
    parts.push(`Genres: ${details.genres.map((g: any) => g.name).join(', ')}`);
  }

  // Networks
  if (details.networks?.length) {
    parts.push(`Zu sehen bei: ${details.networks.map((n: any) => n.name).join(', ')}`);
  }

  // Creators
  if (details.created_by?.length) {
    parts.push(`Erschaffen von: ${details.created_by.map((c: any) => c.name).join(', ')}`);
  }

  // First air date
  if (details.first_air_date) {
    const year = new Date(details.first_air_date).getFullYear();
    parts.push(`Die Serie startete im Jahr ${year}.`);
  }

  // Tagline
  if (details.tagline) {
    parts.push(`Tagline: "${details.tagline}"`);
  }

  // Cast - IMPORTANT: Include detailed cast info for linking
  if (details.credits?.cast?.length) {
    const mainCast = details.credits.cast.slice(0, 8);
    parts.push(`\n## Besetzung und Charaktere\n`);
    parts.push(`Die Hauptrollen werden von folgenden Schauspielern verkörpert:`);
    mainCast.forEach((c: any) => {
      parts.push(`- ${c.name} spielt die Rolle von ${c.character || 'einer wichtigen Figur'}`);
    });
    
    // Add a summary line to encourage mentioning actors in the article
    const topActors = mainCast.slice(0, 3).map((c: any) => c.name).join(', ');
    parts.push(`\nMit Stars wie ${topActors} hat die Serie eine hochkarätige Besetzung.`);
  }

  return parts.join('\n\n');
}

// CLI runner
async function main() {
  const tmdbIds = process.argv.slice(2).map(id => parseInt(id, 10)).filter(id => !isNaN(id));

  if (tmdbIds.length === 0) {
    console.log('Usage: npx tsx scripts/create-from-tmdb.ts <tmdbId> [<tmdbId2> ...]');
    console.log('Example: npx tsx scripts/create-from-tmdb.ts 95479 209867 225891');
    process.exit(1);
  }

  console.log(`\n🚀 Creating ${tmdbIds.length} articles from TMDB...\n`);

  for (const tmdbId of tmdbIds) {
    try {
      await createArticleFromTMDB(tmdbId);
    } catch (error) {
      console.error(`\n❌ Failed to create article for TMDB ID ${tmdbId}:`, error);
    }
  }

  console.log('\n✅ All done!\n');
  await prisma.$disconnect();
}

main().catch(console.error);
