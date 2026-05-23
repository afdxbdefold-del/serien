import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const stat = await p.$queryRaw<any[]>`SELECT status, COUNT(*)::int AS c FROM articles GROUP BY status`;
  console.log('STATUS:', stat);
  const arts = await p.$queryRaw<any[]>`
    SELECT slug, title, excerpt, "contentHtml", "darumRelevantText", "wasBedeutetDasText", status
    FROM articles
    ORDER BY "createdAt" DESC NULLS LAST
    LIMIT 3
  `;
  for (const a of arts) {
    process.stdout.write('\n\n=========== ' + a.slug + ' (' + a.status + ') ===========\n');
    process.stdout.write('TITLE: ' + a.title + '\n');
    process.stdout.write('EXCERPT: ' + a.excerpt + '\n');
    const txt = (a.contentHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    process.stdout.write('BODY (1500c): ' + txt.substring(0, 1500) + '\n');
    if (a.darumRelevantText) process.stdout.write('DARUM: ' + a.darumRelevantText.substring(0, 250) + '\n');
    if (a.wasBedeutetDasText) process.stdout.write('BEDEUTET: ' + a.wasBedeutetDasText.substring(0, 250) + '\n');
  }
  await p.$disconnect();
  process.exit(0);
})();
