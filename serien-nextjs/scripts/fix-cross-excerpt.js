const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-um-eine-3-staffel-bei-amazon-prime-verlaengert' }
  });
  
  const newExcerpt = 'Amazon Prime Video hat den Crime-Thriller "Cross" um eine 3. Staffel verlängert.';
  
  console.log('Neuer Excerpt:', newExcerpt);
  
  await prisma.articles.update({
    where: { id: article.id },
    data: { excerpt: newExcerpt }
  });
  
  console.log('✅ Fixed');
  
  await prisma.$disconnect();
}

fix().catch(console.error);
