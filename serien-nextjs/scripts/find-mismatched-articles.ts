/**
 * Find articles that might have been assigned to the wrong series
 * due to the old substring-matching bug
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known problematic patterns where title doesn't match series
const SUSPICIOUS_PATTERNS = [
  { titleContains: 'Dune', shouldNotBe: ['ZatsuTabi', 'Journey'] },
  { titleContains: 'Kennedy', shouldNotBe: ['Agency', 'C.I.A'] },
  { titleContains: 'Fassbender', shouldNotBe: ['Agency'] },
  { titleContains: 'Paradise', shouldNotBe: ['ZatsuTabi'] },
];

async function findMismatchedArticles() {
  console.log('='.repeat(70));
  console.log('SCANNING FOR POTENTIALLY MISMATCHED ARTICLES');
  console.log('='.repeat(70));
  
  const allArticles = await prisma.articles.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      slug: true,
      primarySeriesId: true,
      createdAt: true
    }
  });
  
  const mismatched: any[] = [];
  
  for (const article of allArticles) {
    const series = await prisma.series.findUnique({
      where: { tmdbId: article.primarySeriesId || 0 },
      select: { name: true, tmdbId: true }
    });
    
    const seriesName = series?.name || 'UNKNOWN';
    const titleLower = article.title.toLowerCase();
    const seriesLower = seriesName.toLowerCase();
    
    // Check if series name appears in article title
    let isLikelyMismatch = false;
    let reason = '';
    
    // Check suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (titleLower.includes(pattern.titleContains.toLowerCase())) {
        for (const badMatch of pattern.shouldNotBe) {
          if (seriesLower.includes(badMatch.toLowerCase())) {
            isLikelyMismatch = true;
            reason = `Title contains "${pattern.titleContains}" but assigned to "${seriesName}"`;
            break;
          }
        }
      }
    }
    
    // Generic check: if title has a quoted series name, it should match
    const quotedMatch = article.title.match(/['"„"]([^'""']+)['"„""]/);
    if (quotedMatch && !isLikelyMismatch) {
      const quotedText = quotedMatch[1].toLowerCase();
      if (quotedText.length >= 3 && !seriesLower.includes(quotedText) && !quotedText.includes(seriesLower)) {
        // Check if it's a different series name
        const probableSeries = await prisma.series.findFirst({
          where: {
            OR: [
              { name: { contains: quotedText, mode: 'insensitive' } },
              { title: { contains: quotedText, mode: 'insensitive' } },
            ]
          },
          select: { name: true, tmdbId: true }
        });
        
        if (probableSeries && probableSeries.tmdbId !== article.primarySeriesId) {
          isLikelyMismatch = true;
          reason = `Title quotes "${quotedMatch[1]}" but assigned to "${seriesName}"`;
        }
      }
    }
    
    if (isLikelyMismatch) {
      mismatched.push({
        id: article.id,
        title: article.title.substring(0, 60),
        slug: article.slug,
        assignedSeries: seriesName,
        assignedTmdbId: article.primarySeriesId,
        reason,
        createdAt: article.createdAt
      });
    }
  }
  
  if (mismatched.length > 0) {
    console.log(`\n⚠️  Found ${mismatched.length} potentially mismatched articles:\n`);
    
    for (const m of mismatched) {
      console.log(`  📄 ${m.title}...`);
      console.log(`     Assigned to: ${m.assignedSeries} (TMDB: ${m.assignedTmdbId})`);
      console.log(`     Reason: ${m.reason}`);
      console.log(`     Slug: ${m.slug}`);
      console.log(`     Created: ${m.createdAt}`);
      console.log('');
    }
    
    // Output as JSON for potential fix script
    console.log('\n--- JSON for fix script ---');
    console.log(JSON.stringify(mismatched.map(m => ({
      articleId: m.id,
      slug: m.slug,
      currentTmdbId: m.assignedTmdbId
    })), null, 2));
  } else {
    console.log('\n✅ No obviously mismatched articles found!');
  }
  
  await prisma.$disconnect();
}

findMismatchedArticles().catch(console.error);
