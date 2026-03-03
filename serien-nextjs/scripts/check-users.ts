import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany({
    select: { id: true },
    take: 3
  });
  
  console.log('Users:', users);
  
  await prisma.$disconnect();
}

main().catch(console.error);
