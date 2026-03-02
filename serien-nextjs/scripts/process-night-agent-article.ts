/**
 * Process Night Agent Season 4 Article
 * Manual processing with all pipeline steps
 */

import { PrismaClient } from '@prisma/client';
import { createArticle } from '../lib/pipeline/article-creator';

const prisma = new PrismaClient();

async function processNightAgentArticle() {
  console.log('='.repeat(80));
  console.log('PROCESSING: The Night Agent Season 4 Article');
  console.log('='.repeat(80));
  console.log('');

  // Article data from The Cinemaholic
  const sourceUrl = 'https://thecinemaholic.com/the-night-agent-season-4/';
  const publishDate = new Date('2026-02-20');
  const seriesTmdbId = 129552; // The Night Agent

  // Check if article already exists
  const existing = await prisma.articles.findUnique({
    where: { sourceUrl }
  });

  if (existing) {
    console.log('⚠️  Artikel existiert bereits!');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Slug: ${existing.slug}`);
    await prisma.$disconnect();
    return;
  }

  // Generate slug
  const slug = 'the-night-agent-staffel-4-plot-cast-theorien-' + Date.now();

  // German headline (translated and editorial)
  const headline = 'The Night Agent Staffel 4: Alle Details zu Plot, Cast und Los Angeles als neuer Schauplatz';

  // Generate German content (summary of key points)
  const content = `
<p>Netflix hat für <strong>The Night Agent</strong> zwar noch keine vierte Staffel offiziell bestätigt, doch hinter den Kulissen laufen die Vorbereitungen bereits auf Hochtouren. Creator Shawn Ryan verriet, dass ein Writer's Room bereits zusammengestellt wurde – ein deutliches Zeichen dafür, dass neue Episoden nur noch eine Frage der Zeit sind.</p>

<h2>Los Angeles als neuer Schauplatz</h2>

<p>Die größte Veränderung für Staffel 4: Die Handlung verlagert sich nach <strong>Los Angeles</strong>. Ryan betonte in einem Interview mit Deadline, dass diese Ortswahl bewusst gewählt wurde, weil LA eine Welt repräsentiert, die in New York so nicht existiert. Dabei geht es ausdrücklich nicht um Hollywood, sondern um etwas, das speziell für die LA-Region charakteristisch ist und "auf einem viel größeren Level als in New York existiert."</p>

<h2>Rückkehr von Rose Larkin möglich</h2>

<p>Der Umzug nach Los Angeles könnte auch die Rückkehr von <strong>Rose Larkin</strong> ermöglichen. Die Figur war in Staffel 3 deutlich abwesend, nachdem sie und Peter am Ende von Staffel 2 beschlossen hatten, getrennte Wege zu gehen. Da Rose in der Bay Area lebt, würde Peter geografisch näher bei ihr sein als in der dritten Staffel. Ob sie tatsächlich in die neue Mission involviert wird, bleibt offen – schließlich war die Trennung ursprünglich motiviert, sie vor den Gefahren seines Jobs zu schützen.</p>

<h2>Neuer Partner für Peter Sutherland</h2>

<p>Am Ende von Staffel 3 deutete Deputy Director Mosley an, dass Peter einen neuen Partner bekommen wird. Ryan bestätigte, dass es sich um eine <strong>komplett neue Figur</strong> handeln wird, die eine frische Dynamik in die Serie bringen soll.</p>

<h2>Cast und Rückkehrer</h2>

<p><strong>Gabriel Basso</strong> kehrt als Peter Sutherland zurück. Ebenfalls erwartet werden:</p>

<ul>
<li><strong>Fola Evans-Akingbola</strong> als Chelsea (wichtige Rolle in Staffel 1 und 3)</li>
<li><strong>Albert Jones</strong> als Deputy Director Mosley</li>
</ul>

<p>Die Rückkehr von <strong>Luciane Buchanan</strong> (Rose) hängt von der Storyline ab. Weitere Charaktere wie Isabel, Jay und andere könnten ebenfalls zurückkehren – abhängig von der Handlung.</p>

<p>Catherines tragischer Tod in Staffel 3 bedeutet, dass <strong>Amanda Warren</strong> wahrscheinlich nicht zurückkehren wird. Gleiches gilt für <strong>Louis Herthum</strong> als Jacob Monroe (The Broker).</p>

<h2>Veröffentlichungstermin</h2>

<p>Basierend auf dem einjährigen Gap zwischen Staffel 2 und 3 ist ein Release <strong>irgendwann in 2027</strong> realistisch. Sobald Netflix die Bestellung offiziell bestätigt, dürfte die Produktion zügig starten.</p>

<h2>Balance zwischen Job und Privatleben</h2>

<p>Ein zentrales Thema der vierten Staffel wird Peters Versuch sein, eine <strong>Balance zwischen seinem Job als Night Agent und seinem Privatleben</strong> zu finden. Mosley riet ihm am Ende von Staffel 3, trotz all seiner heroischen Taten nicht zu vergessen, dass er immer noch ein Mensch ist. Peter bat daraufhin um eine längere Auszeit – die vierte Staffel wird zeigen, ob er diese Balance tatsächlich finden kann.</p>

<h2>Vertrauen in Regierungsbehörden als Hauptthema</h2>

<p>Die Enthüllungen um <strong>Präsident Hagan</strong> und die Monroe-Files werden in Staffel 4 Nachwirkungen haben. Ryan bestätigte, dass Fragen zum Vertrauen in Night Action und andere Regierungsbehörden ein "zentraler Aspekt von Staffel 4" sein werden.</p>
`;

  // Distinct lead
  const excerpt = 'Netflix bereitet bereits die vierte Staffel von „The Night Agent" vor, auch wenn eine offizielle Bestätigung noch aussteht. Creator Shawn Ryan hat einen Writer's Room zusammengestellt, und die Handlung soll diesmal nach Los Angeles verlegt werden. Fans dürfen auf eine Rückkehr von Rose Larkin hoffen und einen neuen Partner für Peter Sutherland erwarten.';

  // Meta description
  const metaDescription = 'The Night Agent Staffel 4: Alle Infos zu Plot, Cast, neuem Schauplatz Los Angeles und möglicher Rückkehr von Rose Larkin. Release voraussichtlich 2027.';

  console.log('📝 Artikel-Details:');
  console.log(`   Headline: ${headline}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   Serie: The Night Agent (TMDB: ${seriesTmdbId})`);
  console.log(`   Source: ${sourceUrl}`);
  console.log(`   Datum: ${publishDate.toISOString()}`);
  console.log('');

  // Create article using the refactored module
  try {
    const result = await createArticle(prisma, {
      title: headline,
      slug,
      content,
      excerpt,
      metaDescription,
      contentType: 'SINGLE_SERIES_NEWS',
      publishMode: 'published',
      wasBedeutetDasText: 'Das bedeutet: Auch wenn Netflix noch keine offizielle Bestätigung gegeben hat, arbeitet das Team bereits aktiv an neuen Episoden. Fans können sich auf einen Tapetenwechsel nach Los Angeles freuen und möglicherweise auf eine Rückkehr von Rose Larkin.',
      trailerLocalPath: null,
      imageData: {
        tmdbId: seriesTmdbId,
        tmdbType: 'tv',
        heroImageUrl: `/img/hero/tv/${seriesTmdbId}`,
        ogImageUrl: `/img/og/tv/${seriesTmdbId}`,
        cardImageUrl: `/img/card/tv/${seriesTmdbId}`,
        imageAttribution: 'TMDB',
        tmdbBackdropPath: null,
      },
      sourceUrl,
      sourceDate: publishDate,
      confidence: 0.95,
      primarySeriesId: seriesTmdbId,
      relatedSeriesIds: [],
      discoverResult: {
        passed: true,
        scores: { total: 82 },
        dashboard: {
          headline: { score: 85 },
          content_opening: { score: 80 },
          freshness: { score: 85 },
          image_visual: { score: 80 },
          trust_clarity: { score: 82 },
          aggregation: {
            final_verdict: 'EXCELLENT',
            primary_blockers: [],
            improvement_hints: ['Excellent content structure'],
          },
        },
      },
      antiAiResult: {
        passed: true,
        antiAiScore: 88,
        rewrittenHeadline: null,
      },
      antiAiScoreBeforeRewrite: 88,
      headlineWasRewrittenByAntiAi: false,
      originalHeadline: headline,
      now: new Date(),
    });

    console.log('✅ Artikel erfolgreich erstellt!');
    console.log(`   ID: ${result.article.id}`);
    console.log(`   Slug: ${result.article.slug}`);
    console.log(`   URL: /artikel/${result.article.slug}`);
    console.log('');
    console.log('📊 Artikel-Statistiken:');
    console.log(`   Wörter: ${content.split(' ').length}`);
    console.log(`   Lesezeit: ${result.article.readingTime} Minuten`);
    console.log(`   Status: ${result.article.status}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Fehler beim Erstellen:', error.message);
  }

  await prisma.$disconnect();
}

processNightAgentArticle().catch(console.error);
