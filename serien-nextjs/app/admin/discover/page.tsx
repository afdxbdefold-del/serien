import Link from 'next/link';

export default async function DiscoverDashboard() {
  let audits = [];
  let error = null;

  try {
    // Fetch audits from API
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/admin/discover-dashboard?limit=100`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    audits = data.audits || [];
  } catch (err: any) {
    console.error('[Discover Dashboard] Error:', err);
    error = err.message;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            📊 Discover Score Dashboard
          </h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium">Error loading dashboard</p>
            <p className="text-red-600 text-sm mt-2">{error}</p>
            <p className="text-gray-600 text-sm mt-4">
              Make sure the database is connected and migrations are applied.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          📊 Discover Score Dashboard
        </h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Words</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Freshness</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {audits.map((audit: any) => (
                <tr key={audit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link 
                      href={`/admin/discover/${audit.articleId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {audit.article.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${
                      audit.discoverScore >= 80 ? 'text-green-600' : 
                      audit.discoverScore >= 65 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {audit.discoverScore}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {audit.passed ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">PASS</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">FAIL</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{audit.discoverMode}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{audit.wordCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{audit.freshnessHours}h</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{audit.aiRiskScore}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(audit.createdAt).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {audits.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No audits found. Run pipeline-v1 to generate audits.
          </div>
        )}
      </div>
    </div>
  );
}
