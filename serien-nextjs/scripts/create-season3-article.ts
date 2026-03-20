/**
 * Create One Piece Season 3 article with proper pipeline structure
 */

import { PrismaClient } from '@prisma/client';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { markdownToHtml } from '../lib/markdown-to-html';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';

const prisma = new PrismaClient();

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('🎬 Creating One Piece Season 3 Article with proper pipeline\n');

  // Source data from Cinemaholic
  const sourceText = `
One Piece Staffel 3 - Offizielle Fakten (Quelle: Cinemaholic, März 2026)

PRODUKTIONSSTATUS:
- Staffel 3 ist offiziell in Produktion
- Dreharbeiten finden in Kapstadt, Südafrika statt
- Verlängerung wurde im August 2025 bestätigt
- Erwarteter Release: Ende 2027 oder Anfang 2028

STORY:
- Staffel 3 adaptiert den Alabasta Arc
- Der Alabasta Arc gilt als einer der beliebtesten Story-Abschnitte
- Themen: Wüstenkönigreich, politische Intrigen, Bürgerkrieg
- Prinzessin Vivi bittet die Strohhut-Piraten um Hilfe

NEUE CAST-MITGLIEDER:
- Xolo Maridueña spielt Portgas D. Ace (Luffys älterer Bruder, Feuerteufel-Nutzer)
- Cole Escola spielt Bon Clay / Mr. 2 (exzentrischer Verwandlungskünstler)
- Awdo Awdo spielt Mr. 1 / Daz Bonez (kann seinen Körper in Klingen verwandeln)
- Daisy Head spielt Miss Doublefinger / Paula (Stachel-Teufelsfrucht)

RÜCKKEHRENDE CAST (jetzt in Hauptrollen):
- Charithra Chandran als Prinzessin Vivi Nefertari
- Mikaela Hoover als Stimme von Tony Tony Chopper
- Joe Manganiello als Sir Crocodile / Mr. Zero (Hauptantagonist, Sand-Teufelsfrucht)
- Lera Abova als Nico Robin / Miss All Sunday
- Sendhil Ramamurthy als König Nefertari Cobra
- Callum Kerr als Captain Smoker
- Julia Rehwald als Tashigi
- Vincent Regan als Monkey D. Garp

HAUPTCAST:
- Iñaki Godoy als Monkey D. Luffy
- Mackenyu als Roronoa Zoro
- Emily Rudd als Nami
- Jacob Romero Gibson als Usopp
- Taz Skylar als Sanji

MYTHOLOGIE:
- Die "Will of D"-Mysterien werden weiter ausgebaut
- Ace trägt das "D." in seinem Namen wie Luffy
  `;

  const facts = {
    status: 'In Produktion',
    releaseDate: 'Ende 2027 / Anfang 2028',
    network: 'Netflix',
    setting: 'Alabasta Arc',
    mainCast: ['Iñaki Godoy', 'Mackenyu', 'Emily Rudd', 'Jacob Romero Gibson', 'Taz Skylar'],
    newCast: ['Xolo Maridueña als Ace', 'Cole Escola als Bon Clay', 'Joe Manganiello als Crocodile'],
  };

  // Generate structured content using the real pipeline
  console.log('🤖 Generating structured content...');
  const structuredContent = await generateStructuredContent({
    facts,
    seriesName: 'One Piece',
    originalHeadline: 'One Piece Staffel 3: Release, Cast und alles zum Alabasta Arc',
    sourceText: sourceText,
    contentType: 'NEWS',
    wordCountTarget: 600,
  });

  console.log(`  ✅ Headline: ${structuredContent.headline}`);
  console.log(`  ✅ Sections: ${structuredContent.sections?.length || 0}`);

  // Link cast members
  console.log('\n🔗 Linking cast members...');
  let contentWithLinks = structuredContent.markdown;
  
  try {
    const castResult = await linkCastInMarkdown(contentWithLinks, 111110); // One Piece TMDB ID
    contentWithLinks = castResult.linkedMarkdown;
    console.log(`  ✅ ${castResult.actorsLinked} cast members linked`);
  } catch (e) {
    console.log('  ⚠️ Cast linking skipped:', (e as Error).message);
  }

  // Convert to HTML
  console.log('\n📄 Converting to HTML...');
  const contentHtml = await markdownToHtml(contentWithLinks);

  // Get series
  const series = await prisma.series.findFirst({
    where: { tmdbId: 111110 }
  });

  if (!series) {
    throw new Error('One Piece series not found in database');
  }

  // Get random author
  const authors = await prisma.users.findMany({
    where: { role: { in: ['author', 'admin'] } },
    select: { id: true, name: true }
  });
  const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
  console.log(`  ✅ Author: ${randomAuthor?.name || 'Unknown'}`);

  // Create article
  const slug = generateSlug(structuredContent.headline);
  
  // Delete if exists
  const existing = await prisma.articles.findUnique({ where: { slug } });
  if (existing) {
    await prisma.articles.delete({ where: { slug } });
    console.log(`  🗑️ Deleted existing article`);
  }

  console.log('\n💾 Saving article...');
  const article = await prisma.articles.create({
    data: {
      id: `${Date.now()}-op-s3`,
      slug,
      title: structuredContent.headline,
      contentHtml,
      excerpt: structuredContent.excerpt || 'Netflix bestätigt: One Piece Staffel 3 ist in Produktion. Alle Infos zu Xolo Maridueña als Ace, dem Alabasta Arc und dem Cast.',
      status: 'published',
      contentType: 'NEWS',
      authorId: randomAuthor?.id,
      seriesId: series.id,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      heroImageUrl: `https://image.tmdb.org/t/p/original${series.backdropPath}`,
      heroLocalUrl: `https://image.tmdb.org/t/p/w1280${series.backdropPath}`,
      cardImageUrl: `https://image.tmdb.org/t/p/w500${series.posterPath}`,
      heroVideoUrl: 'https://www.youtube.com/watch?v=Ades3pQbeh8',
    }
  });

  console.log(`\n✅ Article created: ${article.slug}`);
  console.log(`   URL: /one-piece-staffel-3-release-cast-und-alles-zum-alabasta-arc`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
