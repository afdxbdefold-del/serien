import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, ArrowLeft, Trash2 } from 'lucide-react';

export const metadata: Metadata = {
  title: '404 Errors | Admin',
  robots: 'noindex',
};

export const dynamic = 'force-dynamic';

async function getErrorLogs() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const errors = await prisma.error_logs.findMany({
    where: {
      type: '404',
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Group by path
  const grouped = errors.reduce((acc, error) => {
    const path = error.path;
    if (!acc[path]) {
      acc[path] = {
        path,
        count: 0,
        lastSeen: error.createdAt,
        referrers: new Set<string>(),
      };
    }
    acc[path].count++;
    if (error.referrer) {
      acc[path].referrers.add(error.referrer);
    }
    return acc;
  }, {} as Record<string, { path: string; count: number; lastSeen: Date; referrers: Set<string> }>);

  // Convert to array and sort by count
  const groupedArray = Object.values(grouped)
    .map(g => ({
      ...g,
      referrers: Array.from(g.referrers).slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: errors.length,
    uniquePaths: groupedArray.length,
    grouped: groupedArray,
    recent: errors.slice(0, 20),
  };
}

export default async function ErrorsPage() {
  const data = await getErrorLogs();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/pipeline"
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                404 Errors
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Letzte 7 Tage</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Gesamt 404s</div>
            <div className="text-3xl font-bold text-red-600">{data.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Unique Pfade</div>
            <div className="text-3xl font-bold text-orange-600">{data.uniquePaths}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Ø pro Tag</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {Math.round(data.total / 7)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Top Path Hits</div>
            <div className="text-3xl font-bold text-purple-600">
              {data.grouped[0]?.count || 0}
            </div>
          </div>
        </div>

        {/* Grouped by Path */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Top 404 Pfade
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.grouped.slice(0, 20).map((item, i) => (
              <div key={item.path} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}.</span>
                    <div>
                      <code className="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {item.path}
                      </code>
                      {item.referrers.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <ExternalLink className="h-3 w-3" />
                          {item.referrers[0]}
                          {item.referrers.length > 1 && ` +${item.referrers.length - 1}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      item.count > 10 ? 'bg-red-100 text-red-700' :
                      item.count > 5 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.count}x
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.lastSeen).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {data.grouped.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-500">
                Keine 404-Fehler in den letzten 7 Tagen
              </div>
            )}
          </div>
        </div>

        {/* Recent Errors */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Letzte 20 Errors
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500">Zeit</th>
                  <th className="px-4 py-2 text-left text-gray-500">Pfad</th>
                  <th className="px-4 py-2 text-left text-gray-500">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.recent.map((error) => (
                  <tr key={error.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(error.createdAt).toLocaleString('de-DE', { 
                        day: '2-digit', 
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs font-mono text-gray-900 dark:text-white">
                        {error.path}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-xs">
                      {error.referrer || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
