import prisma from '../lib/prisma';
import crypto from 'crypto';
import fs from 'fs';

async function main() {
  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: {
      id: true, slug: true, title: true, excerpt: true, contentHtml: true,
      heroImageUrl: true, heroLocalUrl: true, tmdbId: true, tmdbType: true,
      authorId: true, publishedAt: true,
      users: { select: { name: true } },
    },
  });

  const thin: any[] = [];
  const dupIntro: any[] = [];
  const noLinks: any[] = [];
  const noImages: any[] = [];
  const noAuthor: any[] = [];
  const introHashes = new Map<string, string[]>();
  const firstParaHashes = new Map<string, string[]>();

  for (const a of articles) {
    const html = a.contentHtml || '';
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plain ? plain.split(/\s+/).length : 0;

    if (words < 250) thin.push({ slug: a.slug, words });

    const links = (html.match(/href="\/[^"]*"/g) || []).length;
    if (links === 0) noLinks.push({ slug: a.slug });

    const hasHero = !!(a.heroImageUrl || a.heroLocalUrl || (a.tmdbId && a.tmdbType));
    if (!hasHero && !/<img\s/i.test(html)) noImages.push({ slug: a.slug });

    if (!a.authorId || !a.users?.name) noAuthor.push({ slug: a.slug });

    const excerpt = (a.excerpt || '').trim();
    const firstP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const firstPPlain = firstP ? firstP[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (excerpt && firstPPlain && excerpt.length > 20) {
      const e = excerpt.toLowerCase().substring(0, 100);
      const f = firstPPlain.toLowerCase().substring(0, 100);
      if (e === f || (e.length > 40 && f.includes(e.substring(0, 40)))) {
        dupIntro.push({ slug: a.slug });
      }
    }

    if (plain.length > 200) {
      const hash = crypto.createHash('md5').update(plain.substring(0, 400).toLowerCase()).digest('hex');
      const prev = firstParaHashes.get(hash) || [];
      prev.push(a.slug);
      firstParaHashes.set(hash, prev);
    }
    if (excerpt.length > 40) {
      const eh = crypto.createHash('md5').update(excerpt.toLowerCase()).digest('hex');
      const prev = introHashes.get(eh) || [];
      prev.push(a.slug);
      introHashes.set(eh, prev);
    }
  }

  const dupExcerpts = [...introHashes.entries()].filter(([, v]) => v.length > 1);
  const dupBodies = [...firstParaHashes.entries()].filter(([, v]) => v.length > 1);

  const report: any = {
    summary: {
      total: articles.length,
      thin: thin.length,
      dupIntro: dupIntro.length,
      noInternalLinks: noLinks.length,
      noImages: noImages.length,
      noAuthor: noAuthor.length,
      dupExcerptGroups: dupExcerpts.length,
      dupBodyGroups: dupBodies.length,
    },
    lists: {
      thin,
      dupIntro,
      noInternalLinks: noLinks,
      noImages,
      noAuthor,
      dupExcerpts: dupExcerpts.map(([, slugs]) => slugs),
      dupBodies: dupBodies.map(([, slugs]) => slugs),
    }
  };

  fs.writeFileSync('/tmp/article-quality-report.json', JSON.stringify(report, null, 2));
  console.log('Report written to /tmp/article-quality-report.json');
  console.log(JSON.stringify(report.summary, null, 2));
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
