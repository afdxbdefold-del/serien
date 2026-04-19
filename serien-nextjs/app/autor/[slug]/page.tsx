import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { generateAuthorSlug, matchAuthorBySlug } from '@/lib/author-utils';
import { generateAuthorSchema } from '@/lib/schema-generator';
import Breadcrumb from '@/components/Breadcrumb';
import { generateBreadcrumbSchema } from '@/lib/schema-generator';
import { seoTitle, seoDescription } from '@/lib/seo-meta';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  // Find author by matching slug with generated slug from name
  const allUsers = await prisma.users.findMany({
    where: {
      articles: {
        some: {
          status: 'published',
        },
      },
    },
    select: {
      name: true,
      _count: {
        select: {
          articles: true,
        },
      },
    },
  });

  const author = allUsers.find((user) => 
    user.name && matchAuthorBySlug(slug, user.name)
  );

  if (!author || !author.name) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  const articleCount = author._count.articles;

  const rawTitle = `${author.name} – Autor`;
  const rawDescription = `Alle Artikel von ${author.name} auf serien.de – ${articleCount} ${articleCount === 1 ? 'Artikel' : 'Artikel'} rund um Serien, Streaming und Reviews.`;
  const finalTitle = seoTitle(rawTitle);
  const finalDescription = seoDescription(rawDescription);

  return {
    title: finalTitle,
    description: finalDescription,
    metadataBase: new URL(baseUrl),
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}/autor/${slug}`,
    },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      type: 'profile',
      url: `${baseUrl}/autor/${slug}`,
    },
  };
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;

  // Find all users with published articles
  const allUsers = await prisma.users.findMany({
    where: {
      articles: {
        some: {
          status: 'published',
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      _count: { select: { articles: { where: { status: 'published' } } } },
    },
  });

  // Find matching author(s) — when multiple users share a name, prefer
  // role=author then highest article count. Otherwise a duplicate low-article
  // user can shadow the real author record (and its fullBio).
  const matches = allUsers.filter((user) =>
    user.name && matchAuthorBySlug(slug, user.name)
  );
  matches.sort((a, b) => {
    const ra = a.role === 'author' ? 0 : a.role === 'admin' ? 1 : 2;
    const rb = b.role === 'author' ? 0 : b.role === 'admin' ? 1 : 2;
    if (ra !== rb) return ra - rb;
    return (b._count?.articles || 0) - (a._count?.articles || 0);
  });
  const author = matches[0];

  if (!author || !author.name) {
    notFound();
  }

  // Get full author data including bio and expertise
  const authorFull = await prisma.users.findUnique({
    where: { id: author.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      fullBio: true,
      expertise: true,
      createdAt: true,
    },
  });

  // Get author's articles
  const articles = await prisma.articles.findMany({
    where: {
      authorId: author.id,
      status: 'published',
    },
    orderBy: {
      publishedAt: 'desc',
    },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      heroLocalUrl: true,
      heroImagePath: true,
      ogImageUrl: true,
      publishedAt: true,
      createdAt: true,
      category: true,
      readingTime: true,
      tmdbId: true,
      tmdbType: true,
    },
  });

  const articleCount = articles.length;
  
  // Generate Author Schema
  const authorSchema = generateAuthorSchema({
    name: authorFull?.name || '',
    description: authorFull?.bio || `Autor bei serien.de mit ${articleCount} Artikeln`,
    jobTitle: 'Redakteur',
    expertise: authorFull?.expertise || [],
    url: `/autor/${slug}`,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Author Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
      />
      {/* BreadcrumbList Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateBreadcrumbSchema([
            { name: 'Autoren', url: '/autoren' },
            { name: authorFull?.name || '', url: `/autor/${slug}` },
          ])),
        }}
      />
      
      <div className="container mx-auto px-6 md:px-12 py-8 max-w-6xl">
        <Breadcrumb items={[{ label: 'Autoren', href: '/autoren' }, { label: authorFull?.name || '' }]} className="mb-8" />

        {/* Author Header */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            {author.image ? (
              <div className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={author.image}
                  alt={author.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
                {author.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {authorFull?.name || author.name}
              </h1>
              <p className="text-gray-600 mb-1">
                Autor bei serien.de
              </p>
              <p className="text-sm text-gray-500">
                {articleCount} {articleCount === 1 ? 'Artikel' : 'Artikel'} veröffentlicht
              </p>
            </div>
          </div>

          {/* Bio — full version preferred, fallback to short bio */}
          {((authorFull as any)?.fullBio || authorFull?.bio) && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              {(authorFull as any)?.fullBio ? (
                <div
                  className="text-gray-700 leading-relaxed space-y-4 [&_p]:leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: (authorFull as any).fullBio }}
                />
              ) : (
                <p className="text-gray-700 leading-relaxed">
                  {authorFull?.bio}
                </p>
              )}
            </div>
          )}

          {/* Expertise Tags */}
          {authorFull?.expertise && authorFull.expertise.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Schwerpunkte</h2>
              <div className="flex flex-wrap gap-2">
                {authorFull.expertise.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-cyan-50 text-cyan-700 text-sm font-medium rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Articles Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Alle Artikel von {author.name}
          </h2>

          {articles.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <p className="text-gray-500">Noch keine Artikel veröffentlicht.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => {
                const imageUrl = article.heroImagePath || 
                  article.ogImageUrl || 
                  (article.tmdbId && article.tmdbType 
                    ? `/img/card/${article.tmdbType}/${article.tmdbId}` 
                    : article.heroLocalUrl) || 
                  '/og-image.png';

                const publishedDate = new Date(article.publishedAt || article.createdAt);
                const formattedDate = publishedDate.toLocaleDateString('de-DE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });

                return (
                  <Link
                    key={article.id}
                    href={`/${article.slug}`}
                    className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    {/* Image */}
                    <div className="relative w-full aspect-[16/9] bg-gray-200 overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {article.category && (
                        <span className="absolute top-3 left-3 bg-cyan-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          {article.category}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-cyan-600 transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {article.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formattedDate}</span>
                        {article.readingTime && (
                          <span>{article.readingTime} Min. Lesezeit</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
