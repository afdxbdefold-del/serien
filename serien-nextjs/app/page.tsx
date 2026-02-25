import Link from 'next/link';
export default function HomePage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">serien.de</h1>
      <nav className="space-x-4">
        <Link href="/news" className="text-blue-600">News</Link>
      </nav>
    </div>
  );
}
