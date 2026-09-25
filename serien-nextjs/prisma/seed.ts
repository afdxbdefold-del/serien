import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.users.upsert({
    where: { id: 'redaktion' },
    update: {},
    create: {
      id: 'redaktion',
      email: 'redaktion@serien.de',
      name: 'serien.de',
      role: 'author',
    },
  });
  console.log('Seeded the editorial draft account');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
