import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

interface ArticlePageProps {
  params: { slug: string };
}

export const revalidate = 300; // ISR: 5 Minuten

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      author: {
        select: { name: true, email: true }
      },
      series: {
        select: { title: true, slug: true }
      }
    }
  });

  if (!article || article.status !== 'published') {
    notFound();
  }

  return (
    <article className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="text-xl text-gray-600 mb-4">{article.excerpt}</p>
          )}
          <div className="flex items-center text-sm text-gray-500 space-x-4">
            <span>{article.author.name || 'Redaktion'}</span>
            {article.publishedAt && (
              <time dateTime={article.publishedAt.toISOString()}>
                {new Date(article.publishedAt).toLocaleDateString('de-DE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
            )}
            {article.readingTime && (
              <span>{article.readingTime} Min. Lesezeit</span>
            )}
          </div>
        </header>

        {article.heroLocalUrl && (
          <div className="mb-8">
            <img
              src={article.heroLocalUrl}
              alt={article.title}
              className="w-full h-auto rounded-lg shadow-lg"
            />
          </div>
        )}

        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        {article.series && (
          <footer className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Serie: <strong>{article.series.title}</strong>
            </p>
          </footer>
        )}
      </div>
    </article>
  );
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    select: {
      title: true,
      excerpt: true,
      heroLocalUrl: true,
      publishedAt: true,
      author: { select: { name: true } }
    }
  });

  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt || article.title,
    openGraph: {
      title: article.title,
      description: article.excerpt || article.title,
      type: 'article',
      publishedTime: article.publishedAt?.toISOString(),
      authors: [article.author.name || 'Redaktion'],
      images: article.heroLocalUrl ? [article.heroLocalUrl] : []
    }
  };
}
