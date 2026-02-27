import { Mail, BookOpen } from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/prisma';

const gradientColors: Record<string, string> = {
  'from-rose-500 to-pink-600': 'linear-gradient(135deg, #f43f5e, #db2777)',
  'from-purple-500 to-indigo-600': 'linear-gradient(135deg, #a855f7, #4f46e5)',
  'from-blue-500 to-cyan-600': 'linear-gradient(135deg, #3b82f6, #0891b2)',
  'from-amber-500 to-orange-600': 'linear-gradient(135deg, #f59e0b, #ea580c)',
  'from-teal-500 to-emerald-600': 'linear-gradient(135deg, #14b8a6, #059669)',
  'from-red-500 to-rose-600': 'linear-gradient(135deg, #ef4444, #e11d48)',
  'from-violet-500 to-purple-600': 'linear-gradient(135deg, #8b5cf6, #9333ea)',
  'from-pink-500 to-fuchsia-600': 'linear-gradient(135deg, #ec4899, #c026d3)',
  'from-emerald-500 to-green-600': 'linear-gradient(135deg, #10b981, #16a34a)',
  'from-sky-500 to-blue-600': 'linear-gradient(135deg, #0ea5e9, #2563eb)',
};

function getRandomGradient() {
  const keys = Object.keys(gradientColors);
  return keys[Math.floor(Math.random() * keys.length)];
}

export default async function RedaktionPage() {
  const authors = await prisma.users.findMany({
    where: { role: 'author' },
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
    },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
        {/* Back Link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-8 transition-colors"
        >
          ← Zurück zur Startseite
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Unsere Redaktion
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Das Team hinter serien.de – Expertinnen für alles rund um TV-Serien und Streaming.
          </p>
        </div>

        {/* Authors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {authors.map((author) => {
            const colorKey = getRandomGradient();
            const gradient = gradientColors[colorKey];
            const initials = author.name.split(' ').map(n => n[0]).join('');
            
            return (
              <article 
                key={author.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Avatar Header */}
                <div className="h-24" style={{ background: gradient }}>
                  <div className="flex items-end justify-center h-full translate-y-12">
                    {author.image ? (
                      <img 
                        src={author.image}
                        alt={author.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                      />
                    ) : (
                      <div 
                        className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg"
                        style={{ background: gradient }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="pt-16 pb-6 px-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {author.name}
                    </h2>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {author._count.articles} {author._count.articles === 1 ? 'Artikel' : 'Artikel'}
                      </span>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <a 
                      href={`mailto:${author.email}`}
                      className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Kontakt aufnehmen
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Footer Text */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 text-sm">
            Möchtest du Teil unseres Teams werden? Schreib uns an{' '}
            <a href="mailto:redaktion@serien.de" className="text-blue-600 hover:underline">
              redaktion@serien.de
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
