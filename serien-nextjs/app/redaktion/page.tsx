import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Metadata } from 'next';
import { BookOpen, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Redaktion | serien.de',
  description: 'Lerne das Team hinter serien.de kennen - unsere Autoren und Redakteure.',
};

export default async function AuthorsPage() {
  // Fetch authors (users with role 'author' or 'admin')
  const authors = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'author' },
        { role: 'admin' }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      _count: {
        select: {
          articles: true
        }
      }
    }
  });

  const gradients = [
    'from-rose-500 to-pink-600',
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-emerald-600',
    'from-red-500 to-rose-600',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Unsere Redaktion
        </h1>
        <p className="text-gray-600 mb-10">
          Das Team hinter serien.de – Experten für alles rund um TV-Serien und Streaming.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {authors.map((author, index) => {
            const gradient = gradients[index % gradients.length];
            
            return (
              <article 
                key={author.id}
                className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                {/* Avatar with Gradient */}
                <div className={`h-32 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  {author.image ? (
                    <img
                      src={author.image}
                      alt={author.name}
                      className="w-20 h-20 rounded-full border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-3xl font-bold text-gray-900 border-4 border-white shadow-lg">
                      {author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {author.name}
                  </h2>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <BookOpen className="h-4 w-4" />
                    <span>{author._count.articles} Artikel</span>
                  </div>

                  <a
                    href={`mailto:${author.email}`}
                    className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-600 text-sm font-medium transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    Kontakt
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {authors.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Noch keine Autoren vorhanden.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-20">
        <div className="container mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">serien.de</h3>
              <p className="text-sm text-gray-600">Deine Quelle für TV-Serien News</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/" className="hover:text-gray-900 transition-colors">News</Link></li>
                <li><Link href="/trending" className="hover:text-gray-900 transition-colors">Trending</Link></li>
                <li><Link href="/about" className="hover:text-gray-900 transition-colors">Über uns</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Rechtliches</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/impressum" className="hover:text-gray-900 transition-colors">Impressum</Link></li>
                <li><a href="/" className="hover:text-gray-900 transition-colors">Datenschutz</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-gray-600">
            <p>© 2024 serien.de. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}