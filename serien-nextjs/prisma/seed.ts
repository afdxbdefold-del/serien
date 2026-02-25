import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create or get test user (author)
  const author = await prisma.user.upsert({
    where: { email: 'redaktion@serien.de' },
    update: {},
    create: {
      id: uuidv4(),
      email: 'redaktion@serien.de',
      name: 'Redaktion'
    }
  });

  console.log('✓ Author created');

  // Create 5 Series
  const series = await Promise.all([
    prisma.series.create({
      data: {
        tmdbId: 66732,
        title: 'Stranger Things',
        slug: 'stranger-things',
        overview: 'In den 1980er Jahren verschwindet ein Junge spurlos. Seine Freunde, die Familie und die Polizei suchen nach Antworten und werden in ein außergewöhnliches Geheimnis verwickelt.',
        posterLocalUrl: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400',
        backdropLocalUrl: 'https://images.unsplash.com/photo-1574267432644-f74f8ec93027?w=800',
        firstAirDate: new Date('2016-07-15'),
        status: 'Returning Series'
      }
    }),
    prisma.series.create({
      data: {
        tmdbId: 100088,
        title: 'The Last of Us',
        slug: 'the-last-of-us',
        overview: '20 Jahre nach der Zerstörung der modernen Zivilisation überquert Joel, ein gehärteter Überlebender, das verwüstete Amerika mit Ellie, einem 14-jährigen Mädchen.',
        posterLocalUrl: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400',
        backdropLocalUrl: 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=800',
        firstAirDate: new Date('2023-01-15'),
        status: 'Returning Series'
      }
    }),
    prisma.series.create({
      data: {
        tmdbId: 94997,
        title: 'House of the Dragon',
        slug: 'house-of-the-dragon',
        overview: 'Die Geschichte spielt 200 Jahre vor den Ereignissen von Game of Thrones und erzählt von der Targaryen-Dynastie.',
        posterLocalUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
        backdropLocalUrl: 'https://images.unsplash.com/photo-1579566346927-c68383817a25?w=800',
        firstAirDate: new Date('2022-08-21'),
        status: 'Returning Series'
      }
    }),
    prisma.series.create({
      data: {
        tmdbId: 1396,
        title: 'Breaking Bad',
        slug: 'breaking-bad',
        overview: 'Ein Chemielehrer mit Krebs verwandelt sich in einen skrupellosen Methamphetamin-Produzenten, um die finanzielle Zukunft seiner Familie zu sichern.',
        posterLocalUrl: 'https://images.unsplash.com/photo-1574267432644-f74f8ec93027?w=400',
        backdropLocalUrl: 'https://images.unsplash.com/photo-1618945524163-32451704c499?w=800',
        firstAirDate: new Date('2008-01-20'),
        status: 'Ended'
      }
    }),
    prisma.series.create({
      data: {
        tmdbId: 76479,
        title: 'The Boys',
        slug: 'the-boys',
        overview: 'Eine Gruppe von Vigilanten macht Jagd auf korrupte Superhelden, die ihre Superkräfte missbrauchen.',
        posterLocalUrl: 'https://images.unsplash.com/photo-1608889476561-6242cfdbf622?w=400',
        backdropLocalUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=800',
        firstAirDate: new Date('2019-07-26'),
        status: 'Returning Series'
      }
    })
  ]);

  console.log('✓ 5 Series created');

  // Create 5 News Articles
  const articles = await Promise.all([
    prisma.article.create({
      data: {
        id: uuidv4(),
        slug: 'stranger-things-staffel-5-dreharbeiten-beendet',
        title: 'Stranger Things Staffel 5: Dreharbeiten offiziell beendet!',
        excerpt: 'Die Duffer Brothers verkünden das Ende der Dreharbeiten zur finalen Staffel der Netflix-Hit-Serie.',
        contentHtml: '<p>Nach monatelangen Dreharbeiten ist es nun offiziell: Stranger Things Staffel 5 ist im Kasten! Die Duffer Brothers teilten die freudige Nachricht auf Instagram mit emotionalen Worten.</p><p>Die finale Staffel wird voraussichtlich 2025 auf Netflix erscheinen und verspricht ein episches Finale der beliebten Serie.</p>',
        authorId: author.id,
        seriesTmdbId: 66732,
        status: 'published',
        publishedAt: new Date('2024-02-20T10:00:00Z'),
        category: 'Netflix',
        readingTime: 3,
        heroLocalUrl: 'https://images.unsplash.com/photo-1574267432644-f74f8ec93027?w=1200'
      }
    }),
    prisma.article.create({
      data: {
        id: uuidv4(),
        slug: 'the-last-of-us-staffel-2-startdatum',
        title: 'The Last of Us Staffel 2: HBO verkündet Starttermin',
        excerpt: 'Die zweite Staffel der erfolgreichen Videospiel-Adaption startet im April 2025.',
        contentHtml: '<p>HBO hat endlich den offiziellen Starttermin für The Last of Us Staffel 2 bekanntgegeben: Ab April 2025 geht es weiter mit Joel und Ellie.</p><p>Die neue Staffel wird sich an Part II des Videospiels orientieren und verspricht noch mehr Drama und Action.</p>',
        authorId: author.id,
        seriesTmdbId: 100088,
        status: 'published',
        publishedAt: new Date('2024-02-19T14:30:00Z'),
        category: 'HBO Max',
        readingTime: 4,
        heroLocalUrl: 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=1200'
      }
    }),
    prisma.article.create({
      data: {
        id: uuidv4(),
        slug: 'house-of-the-dragon-staffel-3-bestaetigt',
        title: 'House of the Dragon: Staffel 3 offiziell bestätigt',
        excerpt: 'HBO verlängert die Game of Thrones-Prequel-Serie um eine weitere Staffel.',
        contentHtml: '<p>Gute Nachrichten für Fans von House of the Dragon: HBO hat die Serie um eine dritte Staffel verlängert.</p><p>Die Dreharbeiten sollen bereits im Sommer 2025 beginnen. Staffel 2 startet im Juni 2024.</p>',
        authorId: author.id,
        seriesTmdbId: 94997,
        status: 'published',
        publishedAt: new Date('2024-02-18T09:15:00Z'),
        category: 'HBO Max',
        readingTime: 2,
        heroLocalUrl: 'https://images.unsplash.com/photo-1579566346927-c68383817a25?w=1200'
      }
    }),
    prisma.article.create({
      data: {
        id: uuidv4(),
        slug: 'breaking-bad-film-geruechte',
        title: 'Breaking Bad: Kommt ein neuer Film?',
        excerpt: 'Vince Gilligan deutet in einem Interview die Möglichkeit eines weiteren Breaking Bad Films an.',
        contentHtml: '<p>Könnte es sein, dass wir noch mehr aus dem Breaking Bad Universum sehen werden? Vince Gilligan hat in einem Interview vage Andeutungen gemacht.</p><p>Fans spekulieren bereits wild über eine mögliche Fortsetzung von El Camino oder eine völlig neue Geschichte.</p>',
        authorId: author.id,
        seriesTmdbId: 1396,
        status: 'published',
        publishedAt: new Date('2024-02-17T16:45:00Z'),
        category: 'AMC',
        readingTime: 5,
        heroLocalUrl: 'https://images.unsplash.com/photo-1618945524163-32451704c499?w=1200'
      }
    }),
    prisma.article.create({
      data: {
        id: uuidv4(),
        slug: 'the-boys-staffel-5-finale',
        title: 'The Boys: Staffel 5 wird die letzte sein',
        excerpt: 'Showrunner Eric Kripke bestätigt, dass die Serie mit Staffel 5 enden wird.',
        contentHtml: '<p>The Boys wird nach fünf Staffeln zu Ende gehen. Showrunner Eric Kripke erklärte, dass dies von Anfang an der Plan war.</p><p>Die finale Staffel soll 2026 erscheinen und ein würdiges Ende für die beliebte Superhelden-Satire bieten.</p>',
        authorId: author.id,
        seriesTmdbId: 76479,
        status: 'published',
        publishedAt: new Date('2024-02-16T11:20:00Z'),
        category: 'Prime Video',
        readingTime: 3,
        heroLocalUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=1200'
      }
    })
  ]);

  console.log('✓ 5 Articles created');
  console.log('');
  console.log('🎉 Seeding completed!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   - 1 User (Author)`);
  console.log(`   - 5 Series`);
  console.log(`   - 5 Articles`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
