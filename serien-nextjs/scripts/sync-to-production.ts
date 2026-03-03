/**
 * Sync locally created characters to Production DB
 * This ensures character links in articles don't lead to 404s
 */

import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient();

interface SyncStats {
  characters: number;
  cast: number;
  series: number;
}

async function syncToProduction(seriesTmdbId: number): Promise<SyncStats> {
  const stats: SyncStats = { characters: 0, cast: 0, series: 0 };
  
  console.log(`\n🔄 Synchronizing data for series ${seriesTmdbId} to Production...`);
  console.log('━'.repeat(70));
  
  // Get production DB connection string from env
  const productionDbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!productionDbUrl) {
    throw new Error('❌ PRODUCTION_DATABASE_URL not found in environment');
  }
  
  // Create production Prisma client
  const productionPrisma = new PrismaClient({
    datasources: {
      db: {
        url: productionDbUrl,
      },
    },
  });
  
  try {
    // 1. Sync Series Data
    console.log('\n📺 Syncing Series Data...');
    const localSeries = await localPrisma.series.findUnique({
      where: { tmdbId: seriesTmdbId },
      select: {
        tmdbId: true,
        name: true,
        title: true,
        originalName: true,
        overview: true,
        posterPath: true,
        backdropPath: true,
        firstAirDate: true,
        status: true,
        cast: true,
        trailers: true,
        updatedAt: true,
      },
    });
    
    if (localSeries) {
      await productionPrisma.series.upsert({
        where: { tmdbId: seriesTmdbId },
        update: {
          ...localSeries,
          updatedAt: new Date(),
        },
        create: localSeries,
      });
      console.log(`   ✅ Series synced: ${localSeries.name || localSeries.title}`);
      stats.series = 1;
    }
    
    // 2. Sync Characters
    console.log('\n🎭 Syncing Characters...');
    const localCharacters = await localPrisma.characters.findMany({
      where: { seriesTmdbId },
    });
    
    for (const char of localCharacters) {
      const { createdAt, updatedAt, ...charData } = char;
      
      await productionPrisma.characters.upsert({
        where: { id: char.id },
        update: {
          ...charData,
          updatedAt: new Date(),
        },
        create: {
          ...charData,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`   ✅ Character synced: ${char.name}`);
      stats.characters++;
    }
    
    // 3. Sync Cast Members (Persons)
    console.log('\n👥 Syncing Cast Members...');
    const seriesCast = localSeries?.cast as any[] || [];
    
    if (seriesCast.length > 0) {
      for (const castMember of seriesCast) {
        const localPerson = await localPrisma.persons.findUnique({
          where: { tmdbId: castMember.id },
        });
        
        if (localPerson) {
          const { createdAt, updatedAt, ...personData } = localPerson;
          
          await productionPrisma.persons.upsert({
            where: { tmdbId: localPerson.tmdbId },
            update: {
              ...personData,
              updatedAt: new Date(),
            },
            create: {
              ...personData,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          console.log(`   ✅ Person synced: ${localPerson.name}`);
          stats.cast++;
        }
      }
    }
    
    console.log('\n' + '━'.repeat(70));
    console.log('✅ SYNC COMPLETE');
    console.log(`   Series: ${stats.series}`);
    console.log(`   Characters: ${stats.characters}`);
    console.log(`   Cast: ${stats.cast}`);
    console.log('━'.repeat(70));
    
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  } finally {
    await productionPrisma.$disconnect();
  }
  
  return stats;
}

// CLI Usage
if (require.main === module) {
  const seriesTmdbId = parseInt(process.argv[2]);
  
  if (!seriesTmdbId || isNaN(seriesTmdbId)) {
    console.error('❌ Usage: npx tsx sync-to-production.ts <seriesTmdbId>');
    console.error('   Example: npx tsx sync-to-production.ts 241372');
    process.exit(1);
  }
  
  syncToProduction(seriesTmdbId)
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

export { syncToProduction };
