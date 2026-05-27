import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { generateAuthorSlug, matchAuthorBySlug } from '@/lib/author-utils';
import Breadcrumb from '@/components/Breadcrumb';
import { generateBreadcrumbSchema } from '@/lib/schema-generator';
import { seoTitle, seoDescription } from '@/lib/seo-meta';
import AuthorArticleGrid from '@/components/AuthorArticleGrid';

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

  const baseUrl = 'https://serien.de';
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
      // DEFENSIVE: hide pseudonymous author profiles from Google's index.
      // The bylines + avatars remain visible to direct visitors, but search
      // bots no longer surface these pages — which removes the strongest
      // detectable signal of "AI-scaled fake author network". Reversible:
      // flip back to { index: true, follow: true } once authors have
      // verifiable real-world presence.
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
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

  // Get author's articles (capped at 120 — beyond that we'd need true
  // server-side pagination; client-side "Mehr anzeigen" handles the rest).
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
    take: 120,
  });

  const articleCount = articles.length;

  // DEFENSIVE: no per-author Person JSON-LD anymore — the page is also
  // `noindex,nofollow` (see generateMetadata above). Breadcrumb stays.

  return (
    <div className="min-h-screen bg-gray-50">
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
            <AuthorArticleGrid articles={articles} authorName={author.name} />
          )}
        </div>
      </div>
    </div>
  );
}
