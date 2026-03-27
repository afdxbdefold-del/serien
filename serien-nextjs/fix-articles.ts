import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { searchTvEnhanced } from './lib/tmdb-search-enhanced';

const prisma = new PrismaClient();

async function main() {
  // Fix specific wrong assignments
  const fixes = [
    { slug: 'dune-prophecy-staffel-2-abgeschlossen', searchQuery: 'Dune Prophecy' },
    { slug: 'apple-tvs-sci-fi-hit-startet-wieder-durch', searchQuery: 'Severance' },
  ];
  
  for (const fix of fixes) {
    console.log(`\nFixing: ${fix.slug}`);
    const result = await searchTvEnhanced(fix.searchQuery, '');
    
    if (result?.tmdbId) {
      // Find or create series
      let series = await prisma.series.findFirst({ where: { tmdbId: result.tmdbId } });
      
      if (series) {
        await prisma.articles.update({
          where: { slug: fix.slug },
          data: { seriesId: series.id }
        });
        console.log(`✅ Fixed → ${series.name}`);
      } else {
        console.log(`❌ Series not in DB: ${result.name}`);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
