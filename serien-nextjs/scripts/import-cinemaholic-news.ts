import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importNews() {
  try {
    // Get or create author
    const author = await prisma.users.upsert({
      where: { email: 'import@serien.de' },
      update: {},
      create: {
        id: 'cinemaholic-importer',
        email: 'import@serien.de',
        name: 'CinemaHolic Import',
        role: 'author',
      },
    });

    // Create article
    const article = await prisma.article.create({
      data: {
        id: 'ella-morgan-news-' + Date.now(),
        slug: 'dakota-fanning-ella-morgan-dreht-in-new-york',
        title: "Dakota Fanning's 'Ella Morgan' startet Dreharbeiten in New York im Juli",
        excerpt: 'Apple TV+ Thriller-Serie über eine verdeckte Treasury-Agentin wird zwischen Juli und Dezember in New York gedreht.',
        contentHtml: `
          <p>Dakota Fannings nächste Drama-Serie wird im Empire State gedreht. Die Dreharbeiten für die Apple TV+ Thriller-Show 'Ella Morgan' finden zwischen Juli und Dezember dieses Jahres in New York statt.</p>
          
          <p>Alex Cary ist der Creator und Autor. Kari Skogland führt Regie. Die Geschichte folgt einer verdeckten Treasury-Agentin (Fanning), die in einem milliardenschweren internationalen Konglomerat mit weltverändernden politischen und kriminellen Verbindungen arbeitet.</p>
          
          <p>Sie gerät in einen Konflikt zwischen ihrer Mission und der Überzeugung, dass ihr Hauptziel, der Thronerbe all dieser korrupten Macht, im Kern ein guter Mensch ist und ihre Liebe verdient.</p>
          
          <p>Dakota Fanning wurde durch ihre Auftritte in Filmen wie 'Man on Fire', 'War of the Worlds' und der Twilight-Saga berühmt. Ihre Rollen im letzten Jahrzehnt haben sie zur ersten Wahl für anspruchsvolle Projekte gemacht.</p>
          
          <p><strong>Quelle:</strong> The CinemaHolic</p>
        `,
        authorId: author.id,
        status: 'published',
        publishedAt: new Date('2026-02-19'),
        category: 'Apple TV+',
        readingTime: 2,
        imageAttribution: 'The CinemaHolic',
      },
    });

    console.log('✅ Artikel erfolgreich importiert:', article.slug);
    console.log('📄 Titel:', article.title);
  } catch (error) {
    console.error('❌ Fehler beim Import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importNews();
