import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cbs-verlaengert-allegiance-um-staffel-4' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      metaDescription: true,
      contentHtml: true,
      heroImageUrl: true,
      authorId: true,
      tmdbId: true,
      createdAt: true,
    }
  });

  if (!article) {
    console.log('Artikel nicht gefunden');
    return;
  }

  console.log('='.repeat(70));
  console.log('ALLEGIANCE ARTIKEL - VOLLSTÄNDIGE ANALYSE');
  console.log('='.repeat(70));
  
  console.log('\n### METADATA ###');
  console.log('Title:', article.title);
  console.log('Slug:', article.slug);
  console.log('Author:', article.authorId);
  console.log('TMDB ID:', article.tmdbId);
  console.log('Created:', article.createdAt);
  
  console.log('\n### EXCERPT (Lead) ###');
  console.log(article.excerpt);
  
  console.log('\n### META DESCRIPTION ###');
  console.log(article.metaDescription);
  console.log('Length:', article.metaDescription?.length, 'chars');
  
  console.log('\n### IMAGE ###');
  console.log(article.heroImageUrl ? '✅ Hero Image vorhanden' : '❌ Kein Hero Image');
  console.log(article.heroImageUrl);
  
  console.log('\n### CONTENT STRUCTURE ###');
  const h2Count = (article.contentHtml.match(/<h2>/g) || []).length;
  const h3Count = (article.contentHtml.match(/<h3>/g) || []).length;
  const pCount = (article.contentHtml.match(/<p>/g) || []).length;
  const linkCount = (article.contentHtml.match(/<a /g) || []).length;
  
  console.log('H2 Tags:', h2Count);
  console.log('H3 Tags:', h3Count);
  console.log('Paragraphs:', pCount);
  console.log('Links:', linkCount);
  console.log('Total HTML Length:', article.contentHtml.length, 'chars');
  
  console.log('\n### H2 ÜBERSCHRIFTEN ###');
  const h2Matches = article.contentHtml.match(/<h2>([^<]+)<\/h2>/g);
  if (h2Matches) {
    h2Matches.forEach((h2, i) => {
      const text = h2.replace(/<\/?h2>/g, '');
      const words = text.split(/\s+/).length;
      console.log(`${i + 1}. "${text}"`);
      console.log(`   → ${text.length} chars, ${words} Wörter`);
    });
  }
  
  console.log('\n### CHARACTER LINKS ###');
  const characterLinks = article.contentHtml.match(/<a href="\/charaktere\/[^"]+">([^<]+)<\/a>/g);
  if (characterLinks && characterLinks.length > 0) {
    console.log(`✅ ${characterLinks.length} Character-Links gefunden:`);
    characterLinks.slice(0, 5).forEach(link => {
      const name = link.match(/>([^<]+)</)?.[1];
      console.log(`   - ${name}`);
    });
  } else {
    console.log('⚠️  Keine Character-Links gefunden');
  }
  
  console.log('\n### QUALITÄTSCHECKS ###');
  
  // Check for broken HTML
  const hasDoubleHash = article.contentHtml.includes('##');
  console.log('Markdown ## im HTML:', hasDoubleHash ? '❌ JA (Problem!)' : '✅ NEIN');
  
  // Check for empty paragraphs
  const emptyPs = article.contentHtml.match(/<p>\s*<\/p>/g);
  console.log('Leere Paragraphen:', emptyPs ? `⚠️  ${emptyPs.length}` : '✅ KEINE');
  
  // Check H2 placement
  const h2AfterIncomplete = article.contentHtml.match(/[^.!?]\s*<\/p>\s*<h2>/g);
  console.log('H2 nach unvollendetem Satz:', h2AfterIncomplete ? '❌ JA' : '✅ NEIN');
  
  // Check for AI phrases
  const aiPhrases = ['tauchen ein', 'spannende Entwicklung', 'freuen sich', 'dürfen gespannt sein'];
  const hasAiPhrases = aiPhrases.some(phrase => article.contentHtml.toLowerCase().includes(phrase));
  console.log('AI-Phrasen:', hasAiPhrases ? '⚠️  GEFUNDEN' : '✅ KEINE');
  
  console.log('\n### CONTENT PREVIEW (erste 500 Zeichen) ###');
  const plainText = article.contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(plainText.substring(0, 500) + '...');
  
  console.log('\n' + '='.repeat(70));
  console.log('GESAMTBEWERTUNG');
  console.log('='.repeat(70));
  
  let score = 0;
  let maxScore = 0;
  
  const checks = [
    { name: 'H2-Tags vorhanden', pass: h2Count >= 3, points: 2 },
    { name: 'Keine Markdown im HTML', pass: !hasDoubleHash, points: 2 },
    { name: 'Character-Links', pass: linkCount > 0, points: 1 },
    { name: 'Meta Description Länge OK', pass: (article.metaDescription?.length || 0) <= 155, points: 1 },
    { name: 'H2s korrekt platziert', pass: !h2AfterIncomplete, points: 2 },
    { name: 'Keine leeren Paragraphen', pass: !emptyPs, points: 1 },
    { name: 'Keine AI-Phrasen', pass: !hasAiPhrases, points: 1 },
    { name: 'Hero Image vorhanden', pass: !!article.heroImageUrl, points: 1 },
  ];
  
  checks.forEach(check => {
    maxScore += check.points;
    if (check.pass) {
      score += check.points;
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
  
  console.log(`\n🎯 SCORE: ${score}/${maxScore} (${Math.round(score/maxScore*100)}%)`);
  
  if (score === maxScore) {
    console.log('🎉 PERFEKT! Artikel ist produktionsbereit!');
  } else if (score >= maxScore * 0.8) {
    console.log('✅ GUT! Kleinere Optimierungen möglich.');
  } else if (score >= maxScore * 0.6) {
    console.log('⚠️  OK. Einige Verbesserungen nötig.');
  } else {
    console.log('❌ PROBLEME! Artikel braucht Überarbeitung.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
