import prisma from '../lib/prisma';

async function createPittArticle() {
  // Get The Pitt series
  const series = await prisma.series.findFirst({
    where: { tmdbId: 999999 }
  });

  if (!series) {
    console.error('Series not found');
    return;
  }

  // Get default author
  const author = await prisma.user.findFirst({
    where: { email: 'redaktion@serien.de' }
  });

  if (!author) {
    console.error('No author found');
    return;
  }

  const title = 'The Pitt Staffel 2 Folge 6: Emotionaler Abschied von Louie';
  const slug = 'the-pitt-staffel-2-folge-6-louie-abschied';
  
  const content = `# The Pitt Staffel 2 Folge 6: Emotionaler Abschied von Louie

Die sechste Episode der zweiten Staffel von HBO Max' "The Pitt" liefert einen der emotionalsten Momente der Serie: Der geliebte Stammpatient Louie stirbt im Pittsburgh Trauma Medical Center. Was als routinemäßiger Besuch beginnt, endet mit einem tragischen Verlust, der das gesamte Krankenhauspersonal zutiefst berührt.

## Ein schwerer Verlust erschüttert das Team

Am Ende von Episode 5 findet Langdon Louie bewusstlos vor. Trotz verzweifelter Wiederbelebungsversuche von Dr. Robby, Langdon und Perlah können sie ihn nicht retten. Als Robby den Tod feststellt, ist das gesamte Team schockiert. Louie war mehr als nur ein Patient – er war ein fester Bestandteil des Krankenhausalltags geworden.

Die Nachricht verbreitet sich langsam durch die hektische Notaufnahme. Als Whitaker später vorbeischaut, um nach Louie zu sehen, weiß er noch nichts von dessen Tod. Perlah versucht, ihm die Nachricht behutsam zu überbringen, doch Ogilvie kommt ihr zuvor und verkündet grob, dass Louie "gestorben" sei. Whitaker rennt sofort zu Louies Zimmer.

## Das Geheimnis des Fotos

Langdon entdeckt ein Foto einer Frau in Louies Besitz. Niemand im Team weiß, wer sie ist. Als sie versuchen, Louies Notfallkontakt anzurufen, meldet sich Dana – das Krankenhaus selbst war sein einziger Notfallkontakt. Louie hatte offenbar niemanden mehr in seinem Leben außerhalb des Hospitals.

Während Dana und die neue Praktikantin Emma Louies sterbliche Überreste für die Abschiedszeremonie vorbereiten, erfahren sie, dass Louie ohne Angehörige in einem namenlosen Grab beigesetzt werden würde. Diese Erkenntnis macht die Situation noch tragischer.

## Konflikte und Herausforderungen im Krankenhaus

Parallel zu Louies Tod gibt es weitere Spannungen: Dr. Robby und Dr. Al-Hashimi streiten sich über die Behandlung von Gus, einem Gefängnisinsassen. Dr. Al möchte ihm mehr Zeit geben, da seine gesundheitlichen Probleme durch mangelnde Ernährung im Gefängnis verursacht werden. Robby sorgt sich jedoch um die knappen Bettkapazitäten.

Dana unterstützt schließlich Dr. Als Ansatz und sorgt dafür, dass Gus länger bleiben kann. Diese Entscheidung unterstreicht die grundsätzliche Haltung des Teams: Jeder Patient verdient die bestmögliche Behandlung, unabhängig von den Umständen.

## Die tragische Geschichte hinter dem Foto

Am Ende der Episode versammelt sich das gesamte Personal, um Louie die letzte Ehre zu erweisen. In diesem emotionalen Moment enthüllt Robby die Geschichte hinter dem mysteriösen Foto: Es zeigt Louies verstorbene Ehefrau.

Louie hatte die Frau seines Lebens geheiratet und sie erwarteten ein Kind. Doch ein tragischer Unfall nahm ihm seine Frau und das ungeborene Baby. Dieser Verlust brach Louie so sehr, dass er nie darüber hinwegkam und in den Alkoholismus abrutschte. Er trank, um seinen Schmerz zu ertränken – eine Erkenntnis, die seinen Tod noch herzzerreißender macht.

## Ein würdiger Abschied

Wie Perlah bemerkt, ist es vielleicht ein Trost, dass Louie im Krankenhaus starb, umgeben von Menschen, die sich um ihn kümmerten – auch wenn sie seine Geschichte nicht vollständig kannten. Es war besser als ein einsamer Tod auf der Straße.

Die Episode zeigt eindrucksvoll, wie sehr sich das Personal des Pittsburgh Trauma Medical Center um jeden einzelnen Patienten kümmert, selbst um jene, die die meisten nur als "Stammgäste" kennen. Louies Geschichte erinnert daran, dass hinter jedem Patienten eine tiefgreifende, oft tragische Geschichte steckt.

**The Pitt Staffel 2** läuft aktuell auf **HBO Max**.`;

  const excerpt = 'Die sechste Episode von "The Pitt" Staffel 2 liefert einen emotionalen Moment: Der beliebte Stammpatient Louie stirbt im Pittsburgh Trauma Medical Center. Das Team erfährt seine tragische Geschichte.';

  // Create article
  const article = await prisma.article.create({
    data: {
      slug,
      title,
      excerpt,
      content,
      contentHtml: content, // For now, use same as content
      status: 'published',
      publishedAt: new Date(),
      category: 'recap',
      tmdbId: series.tmdbId,
      tmdbType: 'tv',
      authorId: author.id
    }
  });

  console.log('Article created:', article.title);
  console.log('Slug:', article.slug);
}

createPittArticle().finally(() => prisma.$disconnect());
