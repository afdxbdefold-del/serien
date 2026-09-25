import Link from 'next/link';
import type { Metadata } from 'next';
import { seoDescription, seoTitle } from '@/lib/seo-meta';

export const metadata: Metadata = {
  title: seoTitle('Verantwortung und Autorenschaft'),
  description: seoDescription(
    'Wie serien.de Beiträge erstellt, historische Verfasserangaben prüft und Korrekturen dokumentiert.'
  ),
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://serien.de/autoren' },
};

export default function AutorenPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
          Verantwortung und Autorenschaft
        </h1>
        <div className="space-y-6 text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          <p>
            Für die Veröffentlichung auf serien.de ist der im{' '}
            <Link className="text-cyan-700 underline dark:text-cyan-400" href="/impressum">
              Impressum
            </Link>{' '}
            genannte Betreiber verantwortlich.
          </p>
          <p>
            Das ältere Artikelsystem hat Beiträge auch automatisch erstellt und
            Personennamen zugewiesen. Die tatsächliche Mitwirkung dieser Personen
            und die früher veröffentlichten Lebensläufe sind nicht ausreichend
            belegt. Wir führen diese Angaben deshalb nicht als verifizierte
            Autorenprofile weiter. Die ursprünglichen Zuordnungen bleiben intern
            erhalten, damit Korrekturen nachvollziehbar sind.
          </p>
          <p>
            Wir prüfen bestehende Beiträge schrittweise auf Quellen, sachliche
            Fehler und Deutschlandbezug. Eine technische Quellenprüfung oder
            KI-gestützte Textbearbeitung ist keine menschliche Abnahme.
            Näheres steht in unseren{' '}
            <Link
              className="text-cyan-700 underline dark:text-cyan-400"
              href="/redaktionelle-richtlinien"
            >
              redaktionellen Richtlinien
            </Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
