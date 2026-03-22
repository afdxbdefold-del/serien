/**
 * Backfill Streamer Links
 * 
 * Updates existing articles to link Netflix (and other streamers) to their hub pages.
 * Only links the first occurrence per article.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Streamer Hub URLs
const STREAMER_HUBS: Record<string, string> = {
  'Netflix': '/netflix-serien',
  'Prime Video': '/prime-video-serien',
  'Amazon Prime': '/prime-video-serien',
  // Future hubs:
  // 'Disney+': '/disney-plus-serien',
};

function linkStreamerInHtml(html: string, streamerName: string, hubUrl: string): { html: string; linked: boolean } {
  // Check if already linked
  if (html.includes(`href="${hubUrl}"`)) {
    return { html, linked: false };
  }

  // Match streamer name in text (not already in a link, not in heading)
  // Pattern: streamer name NOT preceded by "> or followed by </a
  const escapedName = streamerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Find first occurrence that is NOT inside a tag or link
  const regex = new RegExp(
    `(?<!<[^>]*)(?<!href="[^"]*")(?<!>)\\b(${escapedName})\\b(?![^<]*</a>)(?![^<]*</h[1-6]>)`,
    'i'
  );

  const match = regex.exec(html);
  if (!match) {
    return { html, linked: false };
  }

  // Check context - make sure we're not in a heading or already linked
  const beforeMatch = html.substring(Math.max(0, match.index - 200), match.index);
  const afterMatch = html.substring(match.index, Math.min(html.length, match.index + match[0].length + 50));

  // Skip if inside an anchor tag
  const lastOpenA = beforeMatch.lastIndexOf('<a ');
  const lastCloseA = beforeMatch.lastIndexOf('</a>');
  if (lastOpenA > lastCloseA) {
    return { html, linked: false };
  }

  // Skip if inside a heading
  const lastOpenH = beforeMatch.match(/<h[1-6][^>]*>[^<]*$/i);
  if (lastOpenH) {
    return { html, linked: false };
  }

  // Replace first occurrence
  const newHtml = 
    html.substring(0, match.index) + 
    `<a href="${hubUrl}">${match[1]}</a>` + 
    html.substring(match.index + match[0].length);

  return { html: newHtml, linked: true };
}

async function backfillStreamerLinks() {
  console.log('🔗 Backfilling streamer links in existing articles...\n');

  // Get all published articles
  const articles = await prisma.articles.findMany({
    where: {
      OR: [
        { status: 'published' },
        { status: 'PUBLISHED' }
      ]
    },
    select: {
      id: true,
      slug: true,
      title: true,
      contentHtml: true,
    }
  });

  console.log(`Found ${articles.length} published articles\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  const linkedStreamers: Record<string, number> = {};

  for (const article of articles) {
    let contentHtml = article.contentHtml;
    let wasUpdated = false;

    for (const [streamerName, hubUrl] of Object.entries(STREAMER_HUBS)) {
      const result = linkStreamerInHtml(contentHtml, streamerName, hubUrl);
      
      if (result.linked) {
        contentHtml = result.html;
        wasUpdated = true;
        linkedStreamers[streamerName] = (linkedStreamers[streamerName] || 0) + 1;
        console.log(`  ✅ ${article.slug}: Linked "${streamerName}"`);
      }
    }

    if (wasUpdated) {
      await prisma.articles.update({
        where: { id: article.id },
        data: { contentHtml }
      });
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`✅ Updated: ${updatedCount} articles`);
  console.log(`⊘ Skipped: ${skippedCount} articles`);
  
  if (Object.keys(linkedStreamers).length > 0) {
    console.log('\nLinked streamers:');
    for (const [name, count] of Object.entries(linkedStreamers)) {
      console.log(`  - ${name}: ${count} articles`);
    }
  }
  
  console.log('═'.repeat(50));

  await prisma.$disconnect();
}

backfillStreamerLinks().catch(console.error);
