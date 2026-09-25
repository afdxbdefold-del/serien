import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { matchAuthorBySlug } from '@/lib/author-utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getLegacyAccounts(slug: string) {
  const accounts = await prisma.users.findMany({
    where: { articles: { some: { status: 'published' } } },
    select: { id: true, name: true },
  });
  return accounts.filter((account) =>
    account.name && matchAuthorBySlug(slug, account.name)
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const accounts = await getLegacyAccounts(slug);
  if (accounts.length === 0) notFound();

  return {
    title: `Archivzuordnung ${accounts[0].name} | serien.de`,
    description: 'Historische Artikelzuordnung aus dem früheren Publikationssystem.',
    robots: { index: false, follow: true },
    alternates: { canonical: 'https://serien.de/autoren' },
  };
}

export default async function LegacyAuthorPage({ params }: PageProps) {
  const { slug } = await params;
  const accounts = await getLegacyAccounts(slug);
  if (accounts.length === 0) notFound();

  const articles = await prisma.articles.findMany({
    where: {
      authorId: { in: accounts.map((account) => account.id) },
      status: 'published',
    },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, slug: true, title: true },
    take: 120,
  });

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container mx-auto max-w-3xl px-6 py-16">
        <Link className="text-cyan-700 underline dark:text-cyan-400" href="/autoren">
          Verantwortung und Autorenschaft
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
          Historische Zuordnung: {accounts[0].name}
        </h1>
        <p className="mt-5 leading-relaxed text-gray-700 dark:text-gray-300">
          Das frühere Publikationssystem hat die folgenden Artikel unter diesem
          Namen gespeichert. Daraus lässt sich nicht belegen, wer die Texte
          tatsächlich verfasst oder geprüft hat. Frühere Lebensläufe und
          Porträts zeigen wir deshalb nicht mehr an. Für die Veröffentlichung
          ist der im <Link className="underline" href="/impressum">Impressum</Link>{' '}
          genannte Betreiber verantwortlich.
        </p>
        <h2 className="mt-10 text-xl font-semibold text-gray-900 dark:text-white">
          Im System zugeordnete Artikel
        </h2>
        <ul className="mt-4 space-y-3">
          {articles.map((article) => (
            <li key={article.id}>
              <Link className="text-cyan-700 underline dark:text-cyan-400" href={`/${article.slug}`}>
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
