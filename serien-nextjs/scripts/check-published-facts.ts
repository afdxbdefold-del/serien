/**
 * Retroactive Fact Safety Check
 * 
 * Prüft bereits publizierte Artikel auf unverified facts
 */

import { PrismaClient } from '@prisma/client';
import { factSafetyCheck } from '../lib/fact-safety-layer';

const prisma = new PrismaClient();

async function checkPublishedArticle(slug: string) {
  console.log(`\n🛡️  RETROACTIVE FACT SAFETY CHECK`);
  console.log('='.repeat(70));
  console.log(`Article: ${slug}\n`);

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      contentHtml: true,
      publishMode: true,
      status: true,
      primarySeriesId: true,
      primarySeries: {
        select: {
          name: true,
          status: true,
          numberOfSeasons: true,
          lastAirDate: true
        }
      }
    }
  });

  if (!article) {
    console.log('❌ Article not found');
    return;
  }

  console.log(`Title: ${article.title}`);
  console.log(`Status: ${article.status}`);
  console.log(`Mode: ${article.publishMode}`);
  console.log('');
  console.log('TMDB Verification Data:');
  console.log(`  Series: ${article.primarySeries?.name}`);
  console.log(`  Status: ${article.primarySeries?.status || 'UNKNOWN'}`);
  console.log(`  Seasons: ${article.primarySeries?.numberOfSeasons || 'UNKNOWN'}`);
  console.log(`  Last Air: ${article.primarySeries?.lastAirDate ? new Date(article.primarySeries.lastAirDate).toLocaleDateString() : 'UNKNOWN'}`);
  console.log('');

  // Run fact safety check
  const result = await factSafetyCheck({
    articleHtml: article.contentHtml || '',
    headline: article.title,
    extractedFacts: '',
    tmdbSeriesData: article.primarySeries ? {
      status: article.primarySeries.status,
      lastAirDate: article.primarySeries.lastAirDate?.toISOString(),
      numberOfSeasons: article.primarySeries.numberOfSeasons || undefined
    } : undefined
  });

  console.log('━'.repeat(70));
  console.log('FACT SAFETY RESULT');
  console.log('━'.repeat(70));
  console.log(`Status: ${result.status}`);
  console.log(`Critical Facts Found: ${result.criticalFacts.length}`);
  console.log(`Unverified Facts: ${result.rejectedFacts.length}`);
  console.log(`Headline Violations: ${result.headlineViolations.length}`);
  console.log('');

  if (result.rejectedFacts.length > 0) {
    console.log('🚨 UNVERIFIED FACTS DETECTED:');
    result.rejectedFacts.forEach((fact, i) => {
      console.log(`\n${i + 1}. Type: ${fact.type}`);
      console.log(`   Claim: "${fact.claim}"`);
      console.log(`   Alternative: "${fact.alternative}"`);
    });
  }

  if (result.headlineViolations.length > 0) {
    console.log('\n🚨 HEADLINE VIOLATIONS:');
    result.headlineViolations.forEach(v => {
      console.log(`   - "${v}"`);
    });
  }

  console.log('\n━'.repeat(70));
  console.log('RECOMMENDATION');
  console.log('━'.repeat(70));

  if (result.status === 'UNSAFE') {
    console.log('🔴 ACTION REQUIRED:');
    console.log('');
    console.log('This article should be:');
    if (result.headlineViolations.length > 0) {
      console.log('  1. DEPUBLISH immediately (headline contains unverified facts)');
      console.log('  2. Rewrite headline to remove unverified claims');
      console.log('  3. Republish after correction');
    } else {
      console.log('  1. Update content to neutralize unverified facts');
      console.log('  2. Replace specific claims with neutral phrasing');
    }
    
    console.log('');
    console.log('Suggested Headline Fix:');
    const neutralHeadline = article.title
      .replace(/startet 202[4-9]/gi, 'Starttermin angekündigt')
      .replace(/endet 202[4-9]/gi, 'wird fortgesetzt')
      .replace(/Staffel \d+/g, 'neue Staffel');
    console.log(`  "${neutralHeadline}"`);
  } else {
    console.log('✅ Article is SAFE - No unverified facts detected');
  }

  await prisma.$disconnect();
}

async function main() {
  const articleSlug = process.argv[2] || 'the-witcher-staffel-4-mit-liam-hemsworth-startet-2027';
  await checkPublishedArticle(articleSlug);
}

if (require.main === module) {
  main().catch(console.error);
}
