import prisma from '../lib/prisma';
import crypto from 'crypto';

async function main() {
  const articles = await prisma.articles.findMany({
    where: {
      OR: [{ status: 'published' }, { status: 'PUBLISHED' }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      heroImageUrl: true,
      heroLocalUrl: true,
      tmdbId: true,
      tmdbType: true,
      authorId: true,
      publishedAt: true,
      users: { select: { name: true } },
    },
  });

  console.log(`Total published articles: ${articles.length}\n`);

  const issues = {
    thin: [] as any[],           // < 250 words
    dupIntro: [] as any[],       // excerpt == first paragraph
    noInternalLinks: [] as any[],// no <a href="/
    noImages: [] as any[],       // no hero image + no TMDB + no <img> in body
    noAuthor: [] as any[],       // no users linked
    lowUnique: [] as any[],      // intro hash collisions
  };

  const introHashes = new Map<string, string[]>(); // hash -> [slugs]
  const firstParaHashes = new Map<string, string[]>();

  for (const a of articles) {
    const html = a.contentHtml || '';
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plain ? plain.split(/\s+/).length : 0;

    // Thin content
    if (words < 250) {
      issues.thin.push({ slug: a.slug, words, title: a.title });
    }

    // No internal links
    const internalLinks = (html.match(/href="\/[^"]*"/g) || []).length;
    if (internalLinks === 0) {
      issues.noInternalLinks.push({ slug: a.slug, title: a.title });
    }

    // No images
    const hasHero = !!(a.heroImageUrl || a.heroLocalUrl || (a.tmdbId && a.tmdbType));
    const hasImgTag = /<img\s/i.test(html);
    if (!hasHero && !hasImgTag) {
      issues.noImages.push({ slug: a.slug, title: a.title });
    }

    // No author
    if (!a.authorId || !a.users?.name) {
      issues.noAuthor.push({ slug: a.slug, title: a.title, authorId: a.authorId });
    }

    // Dup intro: excerpt vs first <p>
    const excerpt = (a.excerpt || '').trim();
    const firstPMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const firstPPlain = firstPMatch ? firstPMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (excerpt && firstPPlain && excerpt.length > 20) {
      const e = excerpt.toLowerCase().substring(0, 100);
      const f = firstPPlain.toLowerCase().substring(0, 100);
      if (e === f || (e.length > 40 && f.includes(e.substring(0, 40)))) {
        issues.dupIntro.push({ slug: a.slug, title: a.title });
      }
    }

    // Low uniqueness: hash first 400 chars of plain content
    if (plain.length > 200) {
      const hash = crypto.createHash('md5').update(plain.substring(0, 400).toLowerCase()).digest('hex');
      const prev = firstParaHashes.get(hash) || [];
      prev.push(a.slug);
      firstParaHashes.set(hash, prev);
    }
    // And hash of excerpt
    if (excerpt.length > 40) {
      const eh = crypto.createHash('md5').update(excerpt.toLowerCase()).digest('hex');
      const prev = introHashes.get(eh) || [];
      prev.push(a.slug);
      introHashes.set(eh, prev);
    }
  }

  // Filter duplicates
  const dupIntros = [...introHashes.entries()].filter(([, v]) => v.length > 1);
  const dupBodies = [...firstParaHashes.entries()].filter(([, v]) => v.length > 1);

  console.log('========== ISSUE SUMMARY ==========');
  console.log(`Thin content (<250 words):     ${issues.thin.length}`);
  console.log(`Duplicate intros (excerpt=p1): ${issues.dupIntro.length}`);
  console.log(`No internal links:             ${issues.noInternalLinks.length}`);
  console.log(`No images:                     ${issues.noImages.length}`);
  console.log(`No author:                     ${issues.noAuthor.length}`);
  console.log(`Low uniqueness – excerpt dup:  ${dupIntros.length} groups`);
  console.log(`Low uniqueness – body 400ch dup: ${dupBodies.length} groups`);

  // Output samples
  const showSample = (name: string, arr: any[], max = 10) => {
    console.log(`\n== ${name} (showing ${Math.min(max, arr.length)}/${arr.length}) ==`);
    arr.slice(0, max).forEach(x => console.log(`  - ${x.slug}${x.words !== undefined ? ` [${x.words} words]` : ''}`));
  };

  showSample('THIN (<250 words)', issues.thin, 15);
  showSample('DUPLICATE INTROS (excerpt = first paragraph)', issues.dupIntro, 10);
  showSample('NO INTERNAL LINKS', issues.noInternalLinks, 10);
  showSample('NO IMAGES', issues.noImages, 10);
  showSample('NO AUTHOR', issues.noAuthor, 10);

  if (dupIntros.length > 0) {
    console.log(`\n== DUPLICATE EXCERPTS (showing 5/${dupIntros.length} groups) ==`);
    dupIntros.slice(0, 5).forEach(([hash, slugs]) => {
      console.log(`  Group of ${slugs.length}:`);
      slugs.slice(0, 4).forEach(s => console.log(`    - ${s}`));
    });
  }
  if (dupBodies.length > 0) {
    console.log(`\n== DUPLICATE BODY STARTS (first 400 chars, showing 5/${dupBodies.length} groups) ==`);
    dupBodies.slice(0, 5).forEach(([hash, slugs]) => {
      console.log(`  Group of ${slugs.length}:`);
      slugs.slice(0, 4).forEach(s => console.log(`    - ${s}`));
    });
  }

  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
