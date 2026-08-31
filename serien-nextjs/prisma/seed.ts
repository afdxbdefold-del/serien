import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EDITORIAL_AUTHORS = [
  ['author_001', 'sophie.hartmann@serien.de', 'Sophie Hartmann'],
  ['author_002', 'julia.fischer@serien.de', 'Julia Fischer'],
  ['author_003', 'laura.klein@serien.de', 'Laura Klein'],
  ['author_004', 'marie.weber@serien.de', 'Marie Weber'],
  ['author_005', 'lena.bergmann@serien.de', 'Lena Bergmann'],
  ['author_006', 'emma.mueller@serien.de', 'Emma Mueller'],
  ['author_008', 'nina.wolf@serien.de', 'Nina Wolf'],
  ['author_009', 'mia.braun@serien.de', 'Mia Braun'],
  ['author_010', 'lea.zimmermann@serien.de', 'Lea Zimmermann'],
  ['author_011', 'clara.hoffmann@serien.de', 'Clara Hoffmann'],
  ['author_012', 'sarah.becker@serien.de', 'Sarah Becker'],
] as const;

async function main() {
  for (const [id, email, name] of EDITORIAL_AUTHORS) {
    await prisma.users.upsert({
      where: { email },
      update: { name, role: 'author' },
      create: { id, email, name, role: 'author' },
    });
  }

  console.log(`Seeded ${EDITORIAL_AUTHORS.length} editorial authors`);
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
