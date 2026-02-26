import prisma from '../lib/prisma';

async function findSeries() {
  const series = await prisma.series.findFirst({
    where: {
      name: {
        contains: 'Pitt',
        mode: 'insensitive'
      }
    }
  });
  
  console.log(JSON.stringify(series, null, 2));
}

findSeries().finally(() => prisma.$disconnect());
