import prisma from '../lib/prisma';
async function main() {
  const a = await prisma.articles.findFirst({
    where: { slug: 'seit-staffel-3-reden-fans-wieder-ueber-foundation-und-das-aus-gutem-grund' },
  });
  if (!a) { console.log('NOT FOUND'); return; }
  // Print only headline-related fields
  const keys = Object.keys(a).filter(k => /headline|title|source|publish|contenttype|category|qualityscore|score|metadata|llm|generator|engine|trigger/i.test(k));
  for (const k of keys) {
    let v: any = (a as any)[k];
    if (typeof v === 'string' && v.length > 300) v = v.slice(0, 300) + '…';
    console.log(`${k}:`, v);
  }
  // headline_comparisons
  const hc = await prisma.headline_comparisons.findMany({ where: { articleId: a.id } }).catch(()=>[]);
  console.log('\n--- headline_comparisons ---');
  console.log(JSON.stringify(hc, null, 2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
