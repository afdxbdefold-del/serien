import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'c0e0553140b7bd5f982df64c86319c1b';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface NewsArticle {
  title: string;
  url: string;
  content: string;
  excerpt: string;
  publishDate: Date;
  category: string;
  seriesName?: string;
}

async function searchTMDB(seriesName: string): Promise<{ id: number; type: string; backdrop_path: string | null; poster_path: string | null } | null> {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
      params: {
        api_key: TMDB_API_KEY,
        query: seriesName,
        language: 'de-DE'
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const show = response.data.results[0];
      return {
        id: show.id,
        type: 'tv',
        backdrop_path: show.backdrop_path,
        poster_path: show.poster_path
      };
    }
    return null;
  } catch (error) {
    console.error('TMDB Search Error:', error);
    return null;
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function importNewsArticle(article: NewsArticle) {
  try {
    console.log('\n🔍 Starte Import für:', article.title);

    // 1. Get or create author
    const author = await prisma.user.upsert({
      where: { email: 'crawler@serien.de' },
      update: {},
      create: {
        id: 'news-crawler-bot',
        email: 'crawler@serien.de',
        name: 'News Crawler',
        role: 'author',
      },
    });
    console.log('✅ Author bereit:', author.name);

    // 2. Search TMDB if series name is provided
    let tmdbData = null;
    let tmdbSeriesId = null;
    if (article.seriesName) {
      console.log('🔎 Suche in TMDB:', article.seriesName);
      tmdbData = await searchTMDB(article.seriesName);
      if (tmdbData) {
        console.log('✅ TMDB gefunden! ID:', tmdbData.id);
        
        // Create or update Series entry
        try {
          const series = await prisma.series.upsert({
            where: { tmdbId: tmdbData.id },
            update: {
              backdropPath: tmdbData.backdrop_path,
              posterPath: tmdbData.poster_path,
            },
            create: {
              tmdbId: tmdbData.id,
              title: article.seriesName,
              backdropPath: tmdbData.backdrop_path,
              posterPath: tmdbData.poster_path,
            },
          });
          tmdbSeriesId = series.tmdbId;
          console.log('✅ Series Entry erstellt/aktualisiert');
        } catch (e) {
          console.log('⚠️  Series Entry konnte nicht erstellt werden');
        }
      } else {
        console.log('❌ Keine TMDB-Daten gefunden');
      }
    }

    // 3. Generate image URLs if TMDB data exists
    const imageUrls = tmdbData ? {
      heroImageUrl: `/img/hero/${tmdbData.type}/${tmdbData.id}`,
      ogImageUrl: `/img/og/${tmdbData.type}/${tmdbData.id}`,
      cardImageUrl: `/img/card/${tmdbData.type}/${tmdbData.id}`,
    } : {};

    // 4. Create article
    const slug = generateSlug(article.title);
    const articleData = await prisma.article.create({
      data: {
        id: `crawler-${Date.now()}`,
        slug,
        title: article.title,
        excerpt: article.excerpt,
        contentHtml: article.content,
        authorId: author.id,
        status: 'published',
        publishedAt: article.publishDate,
        category: article.category,
        readingTime: Math.ceil(article.content.split(' ').length / 200),
        imageAttribution: 'TMDB',
        ...(tmdbSeriesId && { tmdbSeriesId }),
        ...(tmdbData && {
          tmdbId: tmdbData.id,
          tmdbType: tmdbData.type,
          tmdbBackdropPath: tmdbData.backdrop_path,
          tmdbPosterPath: tmdbData.poster_path,
          ...imageUrls
        }),
      },
    });

    console.log('\n🎉 Artikel erfolgreich importiert!');
    console.log('📄 Slug:', articleData.slug);
    console.log('🆔 TMDB ID:', tmdbData?.id || 'Keine');
    console.log('🖼️  Bilder:', tmdbData ? '✅ Mit TMDB Images' : '❌ Ohne Bilder');
    console.log('🔗 URL:', `/${slug}`);

    return articleData;
  } catch (error) {
    console.error('\n❌ Fehler beim Import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// News von The Cinemaholic crawlen
async function crawlLatestNews() {
  console.log('🕷️  Crawler gestartet...\n');

  // Beispiel-Artikel (in Produktion würde man hier echtes Web Scraping machen)
  const article: NewsArticle = {
    title: "Star Wars: Skeleton Crew - Staffel 2 bestätigt bei Disney+",
    url: "https://thecinemaholic.com/skeleton-crew-season-2/",
    excerpt: "Die beliebte Star Wars Serie 'Skeleton Crew' wurde offiziell für eine zweite Staffel bei Disney+ verlängert.",
    content: `
      <p>Große Neuigkeiten für Star Wars Fans: Disney+ hat offiziell die Verlängerung von 'Star Wars: Skeleton Crew' für eine zweite Staffel bekanntgegeben.</p>
      
      <p>Die Serie, die in der Star Wars-Galaxis spielt, folgt vier jungen Freunden, die eine mysteriöse Entdeckung auf ihrem scheinbar sicheren Heimatplaneten machen. Sie verlieren sich daraufhin in einer seltsamen und gefährlichen Galaxie und müssen den Weg nach Hause finden.</p>
      
      <p>Die erste Staffel wurde von Kritikern und Fans gleichermaßen gelobt für ihre frische Herangehensweise an das Star Wars-Universum und die starken Charakterentwicklungen. Mit der Verlängerung für Staffel 2 zeigt Disney+ sein Vertrauen in die Serie.</p>
      
      <p>Die Produktion für die zweite Staffel soll voraussichtlich noch in diesem Jahr beginnen. Ein genaues Startdatum wurde noch nicht bekanntgegeben.</p>
      
      <p><strong>Quelle:</strong> The CinemaHolic</p>
    `,
    publishDate: new Date('2026-02-25'),
    category: 'Disney+',
    seriesName: 'Star Wars: Skeleton Crew'
  };

  await importNewsArticle(article);
}

// Script ausführen
crawlLatestNews()
  .then(() => {
    console.log('\n✅ Crawler erfolgreich beendet');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Crawler Fehler:', error);
    process.exit(1);
  });
