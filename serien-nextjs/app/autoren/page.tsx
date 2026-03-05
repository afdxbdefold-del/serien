import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { getAuthorUrl } from '@/lib/author-utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Unsere Autoren | serien.de',
  description: 'Entdecke alle Autoren von serien.de und ihre Artikel über aktuelle Serien und Streaming-News.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/autoren',
  },
};

export default async function AutorenPage() {
  // Get all users with published articles
  const authors = await prisma.users.findMany({
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
      createdAt: true,
      _count: {
        select: {
          articles: true,
        },
      },
      articles: {
        where: {
          status: 'published',
        },
        take: 1,
        orderBy: {
          publishedAt: 'desc',
        },
        select: {
          publishedAt: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Filter out authors without names
  const validAuthors = authors.filter((author) => author.name);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 md:px-12 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Unsere Autoren
          </h1>
          <p className="text-lg text-gray-600">
            Lerne das Team hinter serien.de kennen und entdecke ihre Artikel.
          </p>
        </div>

        {/* Authors Grid */}
        {validAuthors.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-500">Noch keine Autoren verfügbar.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {validAuthors.map((author) => {
              const articleCount = author._count.articles;
              const lastPublished = author.articles[0]?.publishedAt;
              
              let lastPublishedText = '';
              if (lastPublished) {
                const date = new Date(lastPublished);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                  lastPublishedText = 'Heute veröffentlicht';
                } else if (diffDays === 1) {
                  lastPublishedText = 'Gestern veröffentlicht';
                } else if (diffDays < 7) {
                  lastPublishedText = `Vor ${diffDays} Tagen veröffentlicht`;
                } else {
                  lastPublishedText = date.toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'long',
                  });
                }
              }

              return (
                <Link
                  key={author.id}
                  href={getAuthorUrl(author.name!)}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-shadow group"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {author.image ? (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                        <Image
                          src={author.image}
                          alt={author.name!}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                        {author.name!.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-cyan-600 transition-colors">
                        {author.name}
                      </h2>
                      <p className="text-sm text-gray-600 mb-2">
                        {articleCount} {articleCount === 1 ? 'Artikel' : 'Artikel'}
                      </p>
                      {lastPublishedText && (
                        <p className="text-xs text-gray-500">
                          {lastPublishedText}
                        </p>
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
  );
}
