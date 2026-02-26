/**
 * Test Script: Download Trailer for an Article
 * 
 * Usage: npx tsx scripts/test-trailer-download.ts <article-slug>
 */

import prisma from '../lib/prisma';
import { 
  findTrailerYouTubeId, 
  downloadYouTubeTrailer, 
  searchYouTubeTrailer 
} from '../lib/trailer-downloader';

async function main() {
  const articleSlug = process.argv[2];

  if (!articleSlug) {
    console.error('❌ Usage: npx tsx scripts/test-trailer-download.ts <article-slug>');
    process.exit(1);
  }

  try {
    // Find article
    const article = await prisma.article.findUnique({
      where: { slug: articleSlug },
      include: {
        primarySeries: {
          select: {
            title: true,
            trailers: true
          }
        }
      }
    });

    if (!article) {
      console.error(`❌ Article not found: ${articleSlug}`);
      process.exit(1);
    }

    console.log(`\n📄 Article: ${article.title}`);
    console.log(`📺 Series: ${article.primarySeries?.title || 'N/A'}\n`);

    // Find trailer YouTube ID
    let youtubeId: string | null = null;

    if (article.primarySeries?.trailers) {
      youtubeId = findTrailerYouTubeId(article.primarySeries.trailers);
      if (youtubeId) {
        console.log(`✅ Found trailer in TMDB data: ${youtubeId}`);
      }
    }

    // Fallback: Search YouTube
    if (!youtubeId && article.primarySeries?.title) {
      console.log('🔍 Searching YouTube for trailer...');
      youtubeId = await searchYouTubeTrailer(article.primarySeries.title);
    }

    if (!youtubeId) {
      console.error('❌ No trailer found');
      process.exit(1);
    }

    // Download trailer
    console.log(`\n🎬 Downloading trailer: https://youtube.com/watch?v=${youtubeId}`);
    const result = await downloadYouTubeTrailer(
      youtubeId,
      article.primarySeries?.title || article.title
    );

    if (result.success && result.localPath) {
      console.log(`\n✅ Download successful!`);
      console.log(`   Local path: ${result.localPath}`);

      // Update article in database
      await prisma.article.update({
        where: { id: article.id },
        data: { trailerLocalUrl: result.localPath }
      });

      console.log(`\n✅ Database updated!`);
      console.log(`\nTest the video at: http://localhost:3000/${article.slug}`);
      
    } else {
      console.error(`\n❌ Download failed: ${result.error}`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
