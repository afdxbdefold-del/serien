import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { getAuthorUrl } from '@/lib/author-utils';
import { seoTitle, seoDescription } from '@/lib/seo-meta';
import SeriesAuthorLookup from './SeriesAuthorLookup';
import GenreExpertsToggle from './GenreExpertsToggle';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: seoTitle('Das serien.de Redaktionsteam'),
  description: seoDescription(
    'Lerne die Redakteurinnen hinter serien.de kennen. Unabhängige Analysen zu Serien, Streaming und TV – mit transparenten Quellen und klaren redaktionellen Standards.'
  ),
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://serien.de/autoren' },
  openGraph: {
    title: 'Das serien.de Redaktionsteam',
    description:
      'Zwölf Redakteurinnen, über 1.400 Artikel, ein klarer Qualitätsanspruch: Wer für serien.de schreibt und woran du erkennst, worauf du dich verlassen kannst.',
    type: 'website',
    url: 'https://serien.de/autoren',
  },
};

// Extract the first benchmark series from a fullBio by finding the first <em>…</em>
// inside paragraph 2 (Expertise paragraph). Returns up to N titles.
function extractBenchmarkSeries(fullBio: string | null, max = 3): string[] {
  if (!fullBio) return [];
  const matches = [...fullBio.matchAll(/<em>([^<]{2,80})<\/em>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of matches) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
    if (unique.length >= max) break;
  }
  return unique;
}

// Pull the leading ~1 sentence (first 160 chars) from the fullBio first paragraph.
function extractTeaser(fullBio: string | null, shortBio: string | null): string {
  const source = fullBio || shortBio || '';
  const text = source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // Find first sentence end within 180 chars
  const slice = text.substring(0, 220);
  const sentenceEnd = slice.search(/[.!?]\s/);
  if (sentenceEnd > 40 && sentenceEnd < 200) {
    return slice.substring(0, sentenceEnd + 1).trim();
  }
  return text.length > 160 ? text.substring(0, 157).trim() + '…' : text;
}

// Extract the joining year from the first paragraph (e.g. "seit 2017")
function extractSince(fullBio: string | null): string | null {
  if (!fullBio) return null;
  const firstPara = fullBio.split('</p>')[0] || '';
  const plain = firstPara.replace(/<[^>]+>/g, ' ');
  const m = plain.match(/seit\s+((?:19|20)\d{2})/i);
  return m ? m[1] : null;
}

// Normalize German/English genre labels into a single canonical form.
// Keeps the list of "headline" genres short and avoids duplicates like
// "Komödie"/"Comedy", "Krimi"/"Crime", "Familie"/"Family".
const GENRE_CANONICAL: Record<string, string> = {
  'komödie': 'Komödie',
  'comedy': 'Komödie',
  'krimi': 'Krimi',
  'crime': 'Krimi',
  'familie': 'Familie',
  'family': 'Familie',
  'kids': 'Familie',
  'drama': 'Drama',
  'mystery': 'Mystery',
  'action & adventure': 'Action & Adventure',
  'sci-fi & fantasy': 'Sci-Fi & Fantasy',
  'reality': 'Reality',
  'animation': 'Animation',
  'dokumentarfilm': 'Dokumentation',
  'documentary': 'Dokumentation',
  'soap': 'Soap',
  'war & politics': 'War & Politics',
};

function canonicalGenre(raw: string): string | null {
  const k = raw.trim().toLowerCase();
  return GENRE_CANONICAL[k] ?? null;
}

// Which genre blocks to display on /autoren, in order. Keeps the section
// editorial: 6 big content pillars that carry real audience weight.
const GENRE_HEADLINES = [
  'Drama',
  'Krimi',
  'Sci-Fi & Fantasy',
  'Mystery',
  'Komödie',
  'Action & Adventure',
] as const;

export default async function AutorenPage() {
  const users = await prisma.users.findMany({
    where: {
      articles: { some: { status: 'published' } },
      // Real editorial team only — must have a generated E-E-A-T fullBio.
      fullBio: { not: null },
      role: { in: ['author', 'admin'] },
    },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      fullBio: true,
      expertise: true,
      role: true,
      createdAt: true,
      _count: { select: { articles: { where: { status: 'published' } } } },
      articles: {
        where: { status: 'published' },
        take: 1,
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      },
    },
  });

  // Dedupe by name — when multiple users share a name, prefer role=author > admin > user,
  // then highest article count. Mirrors the logic in app/autor/[slug]/page.tsx.
  const byName = new Map<string, typeof users[number]>();
  for (const u of users) {
    if (!u.name) continue;
    const existing = byName.get(u.name);
    if (!existing) {
      byName.set(u.name, u);
      continue;
    }
    const scoreOf = (x: typeof u) =>
      (x.role === 'author' ? 0 : x.role === 'admin' ? 1 : 2) * 10000 -
      (x._count?.articles || 0);
    if (scoreOf(u) < scoreOf(existing)) byName.set(u.name, u);
  }

  const authors = Array.from(byName.values()).sort((a, b) =>
    (b._count?.articles || 0) - (a._count?.articles || 0)
  );

  const totalArticles = authors.reduce((sum, a) => sum + (a._count?.articles || 0), 0);
  const totalAuthors = authors.length;

  // ───────────────────────────────────────────────────────────────────────
  // Genre-Expertinnen: aggregate article counts by (author, series-genre).
  // Data-driven author ranking per genre — unlike the manual `expertise`
  // tags, this reflects what each author actually writes about.
  // Computed twice: all-time + last 90 days, so a client toggle can switch.
  // ───────────────────────────────────────────────────────────────────────
  type GenreRow = { author: string; image: string | null; genre: string; cnt: number };

  const buildGenreSections = (rows: GenreRow[]) => {
    const byGenre = new Map<string, Map<string, { author: string; image: string | null; cnt: number }>>();
    for (const row of rows) {
      const g = canonicalGenre(row.genre);
      if (!g) continue;
      if (!byGenre.has(g)) byGenre.set(g, new Map());
      const inner = byGenre.get(g)!;
      const existing = inner.get(row.author);
      if (existing) {
        existing.cnt += row.cnt;
      } else {
        inner.set(row.author, { author: row.author, image: row.image, cnt: row.cnt });
      }
    }
    return GENRE_HEADLINES
      .map((genre) => {
        const inner = byGenre.get(genre);
        if (!inner) return null;
        const top = Array.from(inner.values())
          .sort((a, b) => b.cnt - a.cnt)
          .slice(0, 3);
        if (top.length === 0) return null;
        return { genre, top };
      })
      .filter((x): x is { genre: string; top: { author: string; image: string | null; cnt: number }[] } => !!x);
  };

  const genreRowsAllTime = await prisma.$queryRaw<GenreRow[]>`
    SELECT u.name AS author, u.image AS image, unnest(s.genres) AS genre, COUNT(*)::int AS cnt
    FROM articles a
    JOIN users u ON a."authorId" = u.id
    JOIN series s ON a."primarySeriesId" = s."tmdbId"
    WHERE a.status = 'published'
      AND u.role IN ('author', 'admin')
      AND u."fullBio" IS NOT NULL
    GROUP BY u.name, u.image, genre
  `;

  const genreRows90Days = await prisma.$queryRaw<GenreRow[]>`
    SELECT u.name AS author, u.image AS image, unnest(s.genres) AS genre, COUNT(*)::int AS cnt
    FROM articles a
    JOIN users u ON a."authorId" = u.id
    JOIN series s ON a."primarySeriesId" = s."tmdbId"
    WHERE a.status = 'published'
      AND u.role IN ('author', 'admin')
      AND u."fullBio" IS NOT NULL
      AND a."publishedAt" >= NOW() - INTERVAL '90 days'
    GROUP BY u.name, u.image, genre
  `;

  const genreSectionsAll = buildGenreSections(genreRowsAllTime);
  const genreSections90 = buildGenreSections(genreRows90Days);

  // JSON-LD: list of Person schemas
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Redaktionsteam serien.de',
    numberOfItems: authors.length,
    itemListElement: authors.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: a.name,
        jobTitle: 'Serien-Redakteurin',
        url: `${baseUrl}${getAuthorUrl(a.name!)}`,
        worksFor: { '@type': 'NewsMediaOrganization', name: 'serien.de', url: baseUrl },
        knowsAbout: a.expertise || [],
      },
    })),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <div className="container mx-auto px-6 md:px-12 py-16 max-w-6xl">
        {/* Hero */}
        <header className="mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold tracking-wide uppercase mb-5">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
            Redaktion
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-5 leading-tight">
            Das Team hinter serien.de
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            {totalAuthors} Redakteurinnen mit Schwerpunkten von Drama bis Sci-Fi. Wir analysieren
            Serien, prüfen Quellen und ordnen Streaming-News so ein, dass du nicht raten musst, was
            stimmt und was Spekulation ist.
          </p>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg">
            <div>
              <div className="text-3xl font-bold text-slate-900" data-testid="stat-authors">{totalAuthors}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Redakteur*innen</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900" data-testid="stat-articles">{totalArticles.toLocaleString('de-DE')}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Artikel veröffentlicht</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">0</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Bezahlte Reviews</div>
            </div>
          </div>
        </header>

        {/* Author cards */}
        <section aria-label="Redaktionsteam">
          {authors.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <p className="text-slate-500">Noch keine Autoren verfügbar.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {authors.map((author) => {
                const articleCount = author._count?.articles || 0;
                const benchmarks = extractBenchmarkSeries(author.fullBio as string | null, 3);
                const teaser = extractTeaser(author.fullBio as string | null, author.bio);
                const since = extractSince(author.fullBio as string | null);
                const href = getAuthorUrl(author.name!);

                return (
                  <Link
                    key={author.id}
                    href={href}
                    className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-cyan-400 hover:shadow-xl transition-all overflow-hidden flex flex-col"
                    data-testid={`author-card-${author.name!.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {/* Top: portrait + name */}
                    <div className="p-6 pb-4 flex items-start gap-4">
                      {author.image ? (
                        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-md">
                          <Image
                            src={author.image}
                            alt={author.name!}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ring-2 ring-white shadow-md">
                          {author.name!.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-lg text-slate-900 mb-0.5 group-hover:text-cyan-600 transition-colors leading-tight">
                          {author.name}
                        </h2>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>{articleCount.toLocaleString('de-DE')} Artikel</span>
                          {since && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>seit {since}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Teaser */}
                    {teaser && (
                      <p className="px-6 text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4">
                        {teaser}
                      </p>
                    )}

                    {/* Benchmark series */}
                    {benchmarks.length > 0 && (
                      <div className="px-6 mb-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Fokus-Serien
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {benchmarks.map((title) => (
                            <span
                              key={title}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-md italic font-medium"
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expertise tags */}
                    {author.expertise && author.expertise.length > 0 && (
                      <div className="px-6 mb-5 mt-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {author.expertise.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs font-medium rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {author.expertise.length > 3 && (
                            <span className="text-xs text-slate-400 self-center">
                              +{author.expertise.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CTA footer */}
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-sm font-medium text-cyan-600 flex items-center justify-between">
                      <span>Profil & Artikel ansehen</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Genre-Expertinnen (with All-Time / 90 Tage toggle) */}
        {(genreSectionsAll.length > 0 || genreSections90.length > 0) && (
          <GenreExpertsToggle
            sectionsAllTime={genreSectionsAll}
            sections90Days={genreSections90}
          />
        )}

        {/* Series → Author lookup */}
        <SeriesAuthorLookup />

        {/* Trust section */}
        <section className="mt-20 pt-12 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Unser redaktioneller Anspruch</h2>
          <p className="text-slate-600 mb-8 max-w-3xl">
            Wir behandeln Serien wie jedes andere Medium: mit Recherche, klaren Quellen und einer
            Haltung. Das unterscheidet unsere Arbeit von automatisierter Listen-Content und
            Marketing-Copy.
          </p>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Keine bezahlten Reviews',
                body: 'Kritiken und Einordnungen erfolgen unabhängig von Werbepartnern, Affiliate-Links oder Streaming-Pressevereinbarungen.',
              },
              {
                title: 'Updates mit Zeitstempel',
                body: 'Ändern sich Fakten, ergänzen wir Absätze mit Datum statt stillschweigend zu überschreiben.',
              },
              {
                title: 'Quellen offen benannt',
                body: 'Variety, Deadline, The Hollywood Reporter, TMDB, offizielle Pressemitteilungen. Spekulation wird als solche markiert.',
              },
              {
                title: 'Spoiler klar getrennt',
                body: 'Wir kennzeichnen Story-Details deutlich. Analysen funktionieren für Neueinsteigerinnen wie für Kenner.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-5 border border-slate-200/80">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3 font-bold text-sm">
                  ✓
                </div>
                <h3 className="font-semibold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link href="/redaktionelle-richtlinien" className="text-cyan-600 font-medium hover:underline">
              Redaktionelle Richtlinien →
            </Link>
            <Link href="/impressum" className="text-cyan-600 font-medium hover:underline">
              Impressum →
            </Link>
            <Link href="/kontakt" className="text-cyan-600 font-medium hover:underline">
              Kontakt →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
