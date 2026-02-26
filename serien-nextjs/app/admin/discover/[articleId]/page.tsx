import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ articleId: string }>;
}

export default async function DiscoverScoreDetail({ params }: PageProps) {
  const { articleId } = await params;

  let audit: any = null;
  let error: string | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/admin/discover-dashboard?articleId=${articleId}`,
      { cache: 'no-store' }
    );

    if (response.status === 404) {
      notFound();
    }

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    audit = await response.json();
  } catch (err: any) {
    console.error('[Discover Detail] Error:', err);
    error = err.message;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/admin/discover"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium">Error loading audit</p>
            <p className="text-red-600 text-sm mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!audit) {
    notFound();
  }

  const breakdown = audit.breakdownJson || {};
  const score = audit.discoverScore;
  const passed = audit.passed;

  // Score color
  const scoreColor =
    score >= 80 ? 'text-green-600' : score >= 65 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg =
    score >= 80 ? 'bg-green-50' : score >= 65 ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Link
          href="/admin/discover"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Discover Score Analysis
              </h1>
              <Link
                href={`/${audit.article.slug}`}
                className="text-blue-600 hover:text-blue-800 text-lg"
                target="_blank"
              >
                {audit.article.title}
              </Link>
            </div>

            {/* Overall Status */}
            <div className={`${scoreBg} rounded-lg p-4 text-center`}>
              <div className={`text-4xl font-bold ${scoreColor} mb-1`}>{score}</div>
              <div className="text-sm text-gray-600 mb-2">Score</div>
              {passed ? (
                <div className="flex items-center gap-1 text-green-700 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  PASSED
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-700 font-medium">
                  <XCircle className="h-4 w-4" />
                  FAILED
                </div>
              )}
            </div>
          </div>

          {/* Mode */}
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-gray-600">Mode:</span>{' '}
              <span className="font-medium text-gray-900">{audit.discoverMode}</span>
            </div>
            <div>
              <span className="text-gray-600">Date:</span>{' '}
              <span className="font-medium text-gray-900">
                {new Date(audit.createdAt).toLocaleString('de-DE')}
              </span>
            </div>
          </div>
        </div>

        {/* Metrics Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">📊 Metrics Breakdown</h2>

          <div className="space-y-4">
            {/* Word Count */}
            <MetricCard
              label="Word Count"
              value={audit.wordCount}
              status={audit.wordCount >= (breakdown.minWords || 400) ? 'pass' : 'fail'}
              details={`Minimum: ${breakdown.minWords || 400} words`}
            />

            {/* Has Hero Image */}
            <MetricCard
              label="Hero Image"
              value={audit.hasHero ? 'Yes' : 'No'}
              status={audit.hasHero ? 'pass' : 'fail'}
              details="Required for Google Discover"
            />

            {/* Has Byline */}
            <MetricCard
              label="Byline/Author"
              value={audit.hasByline ? 'Yes' : 'No'}
              status={audit.hasByline ? 'pass' : 'warn'}
              details="Author attribution improves trust"
            />

            {/* Freshness */}
            <MetricCard
              label="Freshness"
              value={`${audit.freshnessHours}h ago`}
              status={audit.freshnessHours <= 48 ? 'pass' : 'warn'}
              details="Fresh content performs better (< 48h ideal)"
            />

            {/* AI Risk Score */}
            <MetricCard
              label="AI Risk Score"
              value={audit.aiRiskScore}
              status={
                audit.aiRiskScore <= 30 ? 'pass' : audit.aiRiskScore <= 50 ? 'warn' : 'fail'
              }
              details="Lower is better. > 50 indicates AI-generated patterns"
            />
          </div>
        </div>

        {/* Detailed Breakdown JSON */}
        {Object.keys(breakdown).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 Detailed Breakdown</h2>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(breakdown, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  status,
  details,
}: {
  label: string;
  value: string | number;
  status: 'pass' | 'fail' | 'warn';
  details: string;
}) {
  const statusConfig = {
    pass: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
    },
    fail: {
      icon: <XCircle className="h-5 w-5 text-red-600" />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
    },
    warn: {
      icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-4 flex items-center gap-4`}>
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-gray-900">{label}</span>
          <span className={`font-bold ${config.text}`}>{value}</span>
        </div>
        <p className="text-sm text-gray-600">{details}</p>
      </div>
    </div>
  );
}
