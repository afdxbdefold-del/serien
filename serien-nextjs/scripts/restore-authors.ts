/**
 * Restore authors from frontend-old
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AUTHORS_DATA = [
  {
    id: "author_001",
    email: "sophie.hartmann@serien.de",
    name: "Sophie Hartmann",
    role: "author",
  },
  {
    id: "author_002",
    email: "julia.fischer@serien.de",
    name: "Julia Fischer",
    role: "author",
  },
  {
    id: "author_003",
    email: "laura.klein@serien.de",
    name: "Laura Klein",
    role: "author",
  },
  {
    id: "author_004",
    email: "marie.weber@serien.de",
    name: "Marie Weber",
    role: "author",
  },
  {
    id: "author_005",
    email: "lena.bergmann@serien.de",
    name: "Lena Bergmann",
    role: "author",
  },
  {
    id: "author_006",
    email: "emma.mueller@serien.de",
    name: "Emma Mueller",
    role: "author",
  },
  {
    id: "author_007",
    email: "anna.schneider@serien.de",
    name: "Anna Schneider",
    role: "author",
  },
  {
    id: "author_008",
    email: "nina.wolf@serien.de",
    name: "Nina Wolf",
    role: "author",
  },
  {
    id: "author_009",
    email: "mia.braun@serien.de",
    name: "Mia Braun",
    role: "author",
  },
  {
    id: "author_010",
    email: "lea.zimmermann@serien.de",
    name: "Lea Zimmermann",
    role: "author",
  },
  {
    id: "author_011",
    email: "clara.hoffmann@serien.de",
    name: "Clara Hoffmann",
    role: "author",
  },
  {
    id: "author_012",
    email: "sarah.becker@serien.de",
    name: "Sarah Becker",
    role: "author",
  }
];

async function restoreAuthors() {
  console.log('📝 Restoring authors from frontend-old...\n');
  
  let created = 0;
  let skipped = 0;

  for (const author of AUTHORS_DATA) {
    try {
      await prisma.users.upsert({
        where: { email: author.email },
        update: {
          name: author.name,
          role: author.role,
        },
        create: author,
      });
      console.log(`✅ ${author.name}`);
      created++;
    } catch (error: any) {
      console.log(`⏭️  ${author.name} (already exists)`);
      skipped++;
    }
  }

  // Remove old test authors
  const testAuthors = [
    'sarah.mueller@serien.de',
    'tom.schmidt@serien.de',
    'lisa.weber@serien.de',
    'mark.klein@serien.de',
  ];

  console.log('\n🗑️  Removing test authors...');
  for (const email of testAuthors) {
    try {
      await prisma.users.delete({ where: { email } });
      console.log(`❌ Removed: ${email}`);
    } catch (error) {
      // Ignore if not found
    }
  }

  const totalAuthors = await prisma.users.count({ where: { role: 'author' } });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total authors in DB: ${totalAuthors}`);
}

restoreAuthors()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
