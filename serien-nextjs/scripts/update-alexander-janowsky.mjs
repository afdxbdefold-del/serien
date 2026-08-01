/**
 * One-off: Aktualisiert den Artikel /alexander-janowsky mit neuem Text.
 * Aufruf: node scripts/update-alexander-janowsky.mjs
 * Setzt Titel, Excerpt, Meta-Description, contentHtml und updatedAt.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'alexander-janowsky';

const NEW_TITLE = 'Alexander Janowsky: Was macht „Steel Buddies"-Alex heute?';

const NEW_META_DESCRIPTION =
  'Alex Janowsky verschwand in Staffel 8 aus „Steel Buddies" und ist auch 2026 nicht zu Morlock Motors zurückgekehrt. Was heute bekannt ist.';

const LEAD =
  'Alexander „Alex" Janowsky gehörte viele Jahre zu den bekanntesten Gesichtern von „Steel Buddies". Während der achten Staffel verschwand der frühere Bürochef jedoch aus der Sendung. Auch 2026 ist er nicht zu Morlock Motors zurückgekehrt.';

const NEW_CONTENT_HTML = `<p>${LEAD}</p>
<h2>Kehrt Alexander Janowsky zu Morlock Motors zurück?</h2>
<p>Die kurze Antwort lautet: Dafür gibt es derzeit keine Anzeichen.</p>
<p>Janowsky war in den ersten sieben Staffeln als Bürochef und Stellvertreter von Michael Manousakis zu sehen. Er kümmerte sich unter anderem um die Bestandsaufnahme, die Buchhaltung und den Verkauf der ungewöhnlichen Fahrzeuge und Militärbestände.</p>
<p>Während der achten Staffel fehlte Alex plötzlich. Werkstattleiter Ingo Meier erklärte damals bei Instagram, Janowsky sei von Michael Manousakis auf unbestimmte Zeit beurlaubt worden. Weitere Einzelheiten nannte er nicht. Wenig später übernahm Andy Macht die Aufgaben im Büro.</p>
<p>Inzwischen steht fest, dass es sich nicht nur um eine kurze Pause handelte. Auch in den späteren „Steel Buddies"-Staffeln kehrte Janowsky nicht dauerhaft zurück. Die aktuelle offizielle Joyn-Seite zu „Morlock Motors – Big Deals im Westerwald" bezeichnet Andy Macht weiterhin ausdrücklich als seinen Nachfolger.</p>
<h2>Warum musste Alex bei „Steel Buddies" gehen?</h2>
<p>Der genaue Grund für Alexander Janowskys Ausscheiden wurde bis heute nicht öffentlich erklärt. Weder Janowsky selbst noch Michael Manousakis haben eine ausführliche Stellungnahme dazu veröffentlicht.</p>
<p>Ob es einen Streit gab, Janowsky gekündigt wurde oder sich beide Seiten einvernehmlich trennten, ist daher nicht bekannt. Die damalige Formulierung, er sei „auf unbestimmte Zeit beurlaubt" worden, lässt keine eindeutige Schlussfolgerung zu. Anderslautende Behauptungen sind Spekulation.</p>
<h2>Was macht Alexander Janowsky heute?</h2>
<p>Auch darüber gibt es keine verlässlich bestätigten Informationen. Janowsky tritt öffentlich kaum noch in Erscheinung und ist weder Teil der aktuellen Morlock-Motors-Sendung noch als Mitarbeiter des Unternehmens aufgeführt.</p>
<p>Im Internet finden sich zwar mehrere berufliche und private Profile von Personen mit dem Namen Alexander Janowsky. Diese lassen sich dem früheren „Steel Buddies"-Bürochef jedoch nicht zweifelsfrei zuordnen.</p>
<h2>Ist Alexander Janowsky krank oder verstorben?</h2>
<p>Für entsprechende Gerüchte gibt es keine belastbaren Hinweise. Weder eine schwere Erkrankung noch der Tod des früheren „Steel Buddies"-Darstellers wurden von seiner Familie, Morlock Motors oder einem Sender bestätigt.</p>
<p>Sein Rückzug aus der Öffentlichkeit sollte deshalb nicht mit einer Erkrankung oder einem Todesfall gleichgesetzt werden.</p>
<h2>So geht es ohne Alex weiter</h2>
<p>Die regulären „Steel Buddies"-Staffeln wurden ohne Janowsky fortgesetzt. 2025 folgte bei DMAX noch die Sonderstaffel „Projekt Panther". Parallel wechselten Michael Manousakis und sein Team mit der Nachfolgeserie „Morlock Motors – Big Deals im Westerwald" zu Kabel Eins.</p>
<p>Von dieser Sendung wurden inzwischen vier Staffeln veröffentlicht. Die jüngsten Folgen liefen im Frühjahr 2026. Andy Macht übernimmt weiterhin die administrativen Aufgaben, die früher Alexander Janowsky erledigte.</p>
<p>Damit ist ein Comeback von Alex zwar theoretisch nicht ausgeschlossen, nach mehr als fünf Jahren Abwesenheit aber sehr unwahrscheinlich.</p>
<p><em>Stand: 1. August 2026</em></p>`;

async function main() {
  const existing = await prisma.articles.findUnique({
    where: { slug: SLUG },
    select: { id: true, title: true, updatedAt: true },
  });
  if (!existing) {
    console.error(`Artikel /${SLUG} nicht gefunden.`);
    process.exit(1);
  }
  console.log('VORHER:', existing);

  const updated = await prisma.articles.update({
    where: { slug: SLUG },
    data: {
      title: NEW_TITLE,
      excerpt: LEAD,
      metaDescription: NEW_META_DESCRIPTION,
      contentHtml: NEW_CONTENT_HTML,
      updatedAt: new Date(),
    },
    select: { id: true, title: true, updatedAt: true, slug: true },
  });
  console.log('NACHHER:', updated);
  console.log(`\n✅ Artikel /${updated.slug} aktualisiert.`);
}

main()
  .catch((e) => {
    console.error('FEHLER:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
