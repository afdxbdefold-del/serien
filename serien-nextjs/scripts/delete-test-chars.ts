import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deleted1 = await prisma.characters.deleteMany({
    where: { name: 'USMS Agent Grady Bradford' }
  });
  
  const deleted2 = await prisma.characters.deleteMany({
    where: { name: 'Bobby Park' }
  });
  
  console.log(`✅ Gelöscht: ${deleted1.count + deleted2.count} Charaktere`);
}

main().then(() => process.exit(0)).catch(console.error);
