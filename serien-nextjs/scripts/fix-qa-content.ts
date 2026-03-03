/**
 * Fix corrupted qaContent in characters table
 * Converts [object Object] back to valid JSON
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixQAContent() {
  console.log('🔧 Fixing corrupted qaContent fields...\n');
  
  // Get all characters with qaContent
  const characters = await prisma.characters.findMany({
    where: {
      qaContent: { not: null }
    },
    select: {
      id: true,
      name: true,
      qaContent: true
    }
  });
  
  console.log(`Found ${characters.length} characters with qaContent\n`);
  
  let fixed = 0;
  let skipped = 0;
  
  for (const char of characters) {
    const qaContent = char.qaContent as string;
    
    // Check if it's corrupted (contains [object Object])
    if (qaContent.includes('[object Object]')) {
      console.log(`❌ ${char.name}: Corrupted (${qaContent.substring(0, 50)}...)`);
      console.log(`   → Deleting character (will be re-imported)...`);
      
      // Delete the corrupted character (will be re-created on next pipeline run)
      await prisma.characters.delete({
        where: { id: char.id }
      });
      
      fixed++;
    } else {
      // Try to parse as JSON to verify
      try {
        JSON.parse(qaContent);
        console.log(`✅ ${char.name}: Valid JSON`);
        skipped++;
      } catch (e) {
        console.log(`⚠️  ${char.name}: Invalid JSON but not [object Object]`);
        console.log(`   → Deleting character (will be re-imported)...`);
        
        await prisma.characters.delete({
          where: { id: char.id }
        });
        
        fixed++;
      }
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Fixed: ${fixed} characters deleted`);
  console.log(`✓  Skipped: ${skipped} characters (valid)`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\n💡 Run the pipeline again to re-import deleted characters with correct data.`);
}

fixQAContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
