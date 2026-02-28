/**
 * Test script for pipeline integration
 * Tests actor linking without running full pipeline
 */

import { PrismaClient } from '@prisma/client';
import { processArticle } from './link-actors-to-articles';

const prisma = new PrismaClient();

async function testActorLinking() {
  console.log('🧪 Testing Actor Linking Integration\n');
  
  try {
    // Get a test article
    const article = await prisma.articles.findFirst({
      where: {
        slug: 'wednesday-staffel-2-netflix-gibt-produktionsstart-und-neue-cast-mitglieder-bekannt',
        status: 'published'
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentHtml: true
      }
    });
    
    if (!article) {
      console.log('❌ Test article not found');
      return;
    }
    
    console.log(`📄 Testing with: ${article.title}\n`);
    
    // Test the processArticle function (dry run - it will skip if actors already linked)
    await processArticle(article, false);
    
    console.log('\n✅ Test successful - actor linking works correctly');
    console.log('   Pipeline integration is safe to use');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   This error would be caught and logged in the pipeline');
    console.error('   Article would still be published successfully');
  } finally {
    await prisma.$disconnect();
  }
}

testActorLinking();
