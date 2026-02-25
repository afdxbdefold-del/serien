/**
 * EMERGENT TV-SERIES CONTENT PIPELINE v1
 * Full 7-step automated pipeline for TV series news
 */

import { PrismaClient } from '@prisma/client';
import { classifyContent, shouldSkipArticle, type ContentType } from '../lib/content-classifier';
import { resolveTmdbSeries, type TmdbResolutionResult } from '../lib/tmdb-resolver';
import { extractFacts } from '../lib/fact-extractor';
import { generateGermanArticle } from '../lib/content-generator';

const prisma = new PrismaClient();

interface CrawledSource {
  title: string;
  url: string;
  text: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function runContentPipeline(source: CrawledSource) {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 EMERGENT TV-SERIES CONTENT PIPELINE v1');
  console.log('='.repeat(70));
  console.log(`\n📄 Source: ${source.title}`);
  console.log(`🔗 URL: ${source.url}`);
  console.log('');

  try {
    // ========== STEP 1: CLASSIFY ==========
    console.log('━'.repeat(70));
    console.log('STEP 1: CONTENT CLASSIFICATION');
    console.log('━'.repeat(70));
    
    const classification = await classifyContent(
      source.title,
      source.url,
      source.text
    );

    console.log(`\n📊 Classification Result:`);
    console.log(`   Type: ${classification.content_type}`);
    console.log(`   Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log(`   Series found: ${classification.series_candidates.length}`);
    console.log(`   Reasoning: ${classification.reasoning}`);

    // HARD GATE: Skip if not allowed type
    if (shouldSkipArticle(classification)) {
      console.log(`\n❌ SKIPPED: Content type "${classification.content_type}" is not allowed`);
      console.log('   Allowed types: SINGLE_SERIES_NEWS, MULTI_SERIES_EDITORIAL');
      return { skipped: true, reason: classification.content_type };
    }

    console.log('\n✅ Classification passed - proceeding to TMDB resolution');

    // ========== STEP 2: TMDB RESOLVE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: TMDB RESOLUTION');
    console.log('━'.repeat(70));

    const resolution = await resolveTmdbSeries(
      classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL',
      classification.series_candidates
    );

    console.log(`\n📊 Resolution Result:`);
    console.log(`   Primary Series: ${resolution.primarySeries.name} (ID: ${resolution.primarySeries.tmdbId})`);
    console.log(`   Related Series: ${resolution.relatedSeries.length}`);
    console.log(`   Total Resolved: ${resolution.totalResolved}`);

    // ========== STEP 3: FACT EXTRACTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: FACT EXTRACTION');
    console.log('━'.repeat(70));

    const facts = await extractFacts(source.title, source.text);

    // ========== STEP 4: AI GENERATE DE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: AI CONTENT GENERATION (German)');
    console.log('━'.repeat(70));

    const generatedContent = await generateGermanArticle(
      facts,
      resolution.primarySeries.name,
      classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL'
    );

    // ========== STEP 5: IMAGES (TMDB) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: IMAGE PIPELINE (TMDB)');
    console.log('━'.repeat(70));

    const primaryTmdbId = resolution.primarySeries.tmdbId;
    
    const imageData = {
      tmdbId: primaryTmdbId,
      tmdbType: 'tv' as const,
      heroImageUrl: `/img/hero/tv/${primaryTmdbId}`,
      ogImageUrl: `/img/og/tv/${primaryTmdbId}`,
      cardImageUrl: `/img/card/tv/${primaryTmdbId}`,
      imageAttribution: 'TMDB',
    };

    console.log(`✅ Image URLs generated from primary series (TMDB ID: ${primaryTmdbId})`);

    // ========== STEP 6: DATES ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6: DATE HANDLING');
    console.log('━'.repeat(70));

    const now = new Date();
    const sourceDate = new Date(); // Could extract from source, but we'll use NOW for now

    console.log(`✅ publishedAt: ${now.toISOString()} (NOW)`);
    console.log(`✅ sourcePublishedAt: ${sourceDate.toISOString()} (internal only)`);

    // ========== STEP 7: PUBLISH ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7: PUBLISH TO DATABASE');
    console.log('━'.repeat(70));

    // Check for duplicate
    const existingArticle = await prisma.article.findUnique({
      where: { sourceUrl: source.url }
    });

    if (existingArticle) {
      console.log('⚠️  Article already exists - SKIPPING');
      return { skipped: true, reason: 'duplicate' };
    }

    // Generate title and excerpt
    const articleTitle = source.title;
    const articleExcerpt = facts.key_statements[0] || source.text.substring(0, 200);
    const slug = generateSlug(articleTitle);

    // Create article with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get random author from database
      const authors = await tx.user.findMany({
        where: { role: 'author' },
        select: { id: true, name: true }
      });

      if (authors.length === 0) {
        throw new Error('No authors found in database');
      }

      // Select random author
      const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
      console.log(`✍️  Selected random author: ${randomAuthor.name}`);

      // Create article
      const article = await tx.article.create({
        data: {
          id: `pipeline-${Date.now()}`,
          slug,
          title: articleTitle,
          excerpt: articleExcerpt,
          contentHtml: generatedContent,
          contentType: classification.content_type,
          authorId: author.id,
          status: 'published',
          publishedAt: now,
          sourcePublishedAt: sourceDate,
          sourceUrl: source.url,
          readingTime: Math.ceil(generatedContent.split(' ').length / 200),
          confidence: classification.confidence,
          primarySeriesId: resolution.primarySeries.tmdbId,
          ...imageData,
        },
      });

      // Create many-to-many relations for related series
      if (resolution.relatedSeries.length > 0) {
        await tx.articleSeries.createMany({
          data: resolution.relatedSeries.map((series, index) => ({
            articleId: article.id,
            seriesId: series.tmdbId,
            position: index + 1,
          })),
        });
      }

      return article;
    });

    console.log('\n✅ Article published successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Slug: ${result.slug}`);
    console.log(`   Primary Series: ${resolution.primarySeries.name}`);
    console.log(`   Related Series: ${resolution.relatedSeries.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 PIPELINE COMPLETE');
    console.log('='.repeat(70) + '\n');

    return {
      success: true,
      article: result,
      classification,
      resolution,
    };

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ PIPELINE FAILED');
    console.error('='.repeat(70));
    console.error(`Error: ${error.message}`);
    console.error('');
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ========== EXAMPLE USAGE ==========
async function main() {
  // Example: Single Series News - NEUER ARTIKEL
  const testArticle: CrawledSource = {
    title: "Stranger Things Staffel 5: Finale Staffel startet 2026",
    url: "https://example.com/stranger-things-season-5-finale",
    text: `Netflix hat den offiziellen Starttermin für die finale fünfte Staffel von Stranger Things bekannt gegeben. Die Serie wird im Sommer 2026 erscheinen. Die Duffer Brothers kehren als Showrunner zurück und haben bestätigt, dass dies die letzte Staffel sein wird. Millie Bobby Brown, Finn Wolfhard, Noah Schnapp und das gesamte Hauptcast kehren zurück. Die Dreharbeiten wurden im Dezember 2025 abgeschlossen. Die finale Staffel wird 8 Episoden umfassen und die Geschichte der Hawkins-Gruppe zu einem epischen Ende bringen.`
  };

  await runContentPipeline(testArticle);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
