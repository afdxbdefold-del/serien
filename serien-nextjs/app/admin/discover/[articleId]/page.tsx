import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, ArrowLeft, ExternalLink, Lightbulb, AlertTriangle } from 'lucide-react';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ articleId: string }>;
}

type MetricBlock = {
  score: number;
  verdict?: 'PASS' | 'FAIL';
  reasons?: string[];
  [key: string]: any;
};

export default async function DiscoverScoreDetail({ params }: PageProps) {
  const { articleId } = await params;

  const dashboard = await prisma.discover_score_dashboards.findFirst({
    where: { articleId },
    orderBy: { timestamp: 'desc' },
  });

  if (!dashboard) {
    notFound();
  }

  const article = await prisma.articles.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      publishMode: true,
      publishedAt: true,
      heroImageUrl: true,
    },
  });

  // Fetch rewrite data from latest pipeline run for this article.
  const pipelineRun = await prisma.pipeline_runs.findFirst({
    where: { articleId },
    orderBy: { startedAt: 'desc' },
    select: { metadata: true },
  });
  const rewrite = (pipelineRun?.metadata as any)?.headlineRewrite ?? null;

  const score = dashboard.discoverScore;
  const passed = score >= 91;

  const scoreColor = score >= 110 ? 'text-green-600' : score >= 91 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = score >= 110 ? 'bg-green-50' : score >= 91 ? 'bg-yellow-50' : 'bg-red-50';

  const headline = (dashboard.headlineMetrics as unknown) as MetricBlock;
  const freshness = (dashboard.freshnessMetrics as unknown) as MetricBlock;
  const content = (dashboard.contentMetrics as unknown) as MetricBlock;
  const image = (dashboard.imageMetrics as unknown) as MetricBlock;
  const trust = (dashboard.trustMetrics as unknown) as MetricBlock;
  // Performance is nested inside headlineMetrics.performance (written by pipeline-v2)
  const performance = ((dashboard.headlineMetrics as any)?.performance ?? null) as MetricBlock | null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/admin/discover-analytics"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          data-testid="back-to-discover-list"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between gap-6 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Discover Score Breakdown</h1>
              {article ? (
                <a
                  href={`/${article.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-lg inline-flex items-center gap-1"
                  data-testid="article-title-link"
                >
                  {article.title}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <p className="text-gray-500 italic">Artikel gelöscht ({articleId.slice(0, 12)}…)</p>
              )}
            </div>

            <div className={`${scoreBg} rounded-lg p-4 text-center min-w-[120px]`}>
              <div className={`text-5xl font-bold ${scoreColor} mb-1`} data-testid="total-score">{score}</div>
              <div className="text-xs text-gray-500 mb-2">von 130</div>
              {passed ? (
                <div className="flex items-center justify-center gap-1 text-green-700 font-medium text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  DISCOVER
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-red-700 font-medium text-sm">
                  <XCircle className="h-4 w-4" />
                  SEARCH_ONLY
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-500">Schwellenwert:</span>{' '}
              <span className="font-medium">≥ 91 Punkte</span>
            </div>
            <div>
              <span className="text-gray-500">Pipeline-Version:</span>{' '}
              <span className="font-medium">{dashboard.pipelineVersion}</span>
            </div>
            <div>
              <span className="text-gray-500">Bewertet:</span>{' '}
              <span className="font-medium">{new Date(dashboard.timestamp).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</span>
            </div>
            {article?.publishMode && (
              <div>
                <span className="text-gray-500">Publish-Mode:</span>{' '}
                <span className="font-medium">{article.publishMode}</span>
              </div>
            )}
          </div>
        </div>

        {/* 5 Kategorien */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <CategoryCard
            emoji="📰"
            title="Headline Hygiene"
            score={headline?.score ?? 0}
            max={30}
            verdict={headline?.verdict}
            checks={[
              { label: 'Klar & spezifisch', ok: headline?.clarity_specific },
              { label: 'Serienname in Headline', ok: headline?.series_name_present },
              { label: 'News-Wert erkennbar', ok: headline?.news_value_clear },
              { label: 'Keine Doppelungen', ok: !headline?.has_duplicates },
              { label: 'Kein Clickbait', ok: !headline?.is_clickbait },
            ]}
            reasons={headline?.reasons}
          />
          <CategoryCard
            emoji="🎯"
            title="Headline Performance"
            score={performance?.score ?? 0}
            max={30}
            verdict={performance?.verdict}
            checks={performance ? [
              { label: 'Open Loop / Neugier', ok: performance.has_curiosity },
              { label: 'Emotionale Verankerung', ok: performance.has_emotion },
              { label: `Scroll-Stop Einstieg${performance.first_word ? ` ("${performance.first_word}")` : ''}`, ok: performance.starts_strong },
              { label: 'Natürliche Sprache (kein KI-Template)', ok: performance.no_ai_phrase },
              { label: 'Starkes Handlungs-Verb', ok: performance.has_strong_verb },
              { label: `Feed-CTR-Profil (${performance.feed_ctr_sub_score ?? 0}/5)`, ok: (performance.feed_ctr_sub_score ?? 0) >= 3 },
            ] : [
              { label: 'Performance-Daten nicht verfügbar (älterer Artikel)', neutral: true },
            ]}
            reasons={performance?.reasons}
          />
          <CategoryCard
            emoji="🕐"
            title="Freshness"
            score={freshness?.score ?? 0}
            max={20}
            verdict={freshness?.verdict}
            checks={[
              { label: 'Von heute', ok: freshness?.is_today },
              { label: `Alter: ${freshness?.age_hours ?? '?'}h`, ok: (freshness?.age_hours ?? 999) <= 24, neutral: true },
              { label: 'Source-Datum passt', ok: !freshness?.source_date_mismatch },
            ]}
            reasons={freshness?.reasons}
          />
          <CategoryCard
            emoji="📝"
            title="Content Opening"
            score={content?.score ?? 0}
            max={20}
            verdict={content?.verdict}
            checks={[
              { label: 'Absatz 1: WAS/WER/WO', ok: content?.paragraph_1_covers_what_who_where },
              { label: 'Absatz 2: Kontext', ok: content?.paragraph_2_provides_context },
              { label: 'Keine Absatz-Wüste (>80 Wörter)', ok: !content?.is_paragraph_desert },
              { label: 'Keine Hype-Sprache', ok: !content?.has_hype_language },
            ]}
            reasons={content?.reasons}
          />
          <CategoryCard
            emoji="🖼️"
            title="Image / Visual"
            score={image?.score ?? 0}
            max={15}
            verdict={image?.verdict}
            checks={[
              { label: 'TMDB Backdrop', ok: image?.is_tmdb_backdrop },
              { label: `Breite ≥ 1200px (${image?.width_px ?? '?'}px)`, ok: image?.width_sufficient },
              { label: 'Eindeutig zur Serie', ok: image?.clearly_series_related },
            ]}
            reasons={image?.reasons}
          />
          <CategoryCard
            emoji="🛡️"
            title="Trust / Clarity"
            score={trust?.score ?? 0}
            max={15}
            verdict={trust?.verdict}
            checks={[
              { label: 'Fakten von Meinung getrennt', ok: trust?.facts_separated_from_opinion },
              { label: 'Kein KI-Füllwort-Geschwafel', ok: trust?.no_ai_bloat },
              { label: 'Keine Spekulation', ok: trust?.no_speculation },
              { label: 'Keine Superlative', ok: trust?.no_superlatives },
            ]}
            reasons={trust?.reasons}
          />
        </div>

        {/* Primary Blockers */}
        {dashboard.primaryBlockers && dashboard.primaryBlockers.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6" data-testid="primary-blockers">
            <h2 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Primary Blockers ({dashboard.primaryBlockers.length})
            </h2>
            <ul className="space-y-1 text-sm text-red-800">
              {dashboard.primaryBlockers.map((blocker, idx) => (
                <li key={idx} className="flex gap-2">
                  <span>•</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvement Hints */}
        {dashboard.improvementHints && dashboard.improvementHints.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6" data-testid="improvement-hints">
            <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Improvement Hints ({dashboard.improvementHints.length})
            </h2>
            <ul className="space-y-1 text-sm text-blue-800">
              {dashboard.improvementHints.map((hint, idx) => (
                <li key={idx} className="flex gap-2">
                  <span>→</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rewrite Loop Outcome */}
        {rewrite && rewrite.attempted && (
          <div
            className={`rounded-xl p-6 mb-6 border ${rewrite.applied ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}
            data-testid="rewrite-card"
          >
            <h2 className={`text-lg font-bold mb-3 flex items-center gap-2 ${rewrite.applied ? 'text-emerald-900' : 'text-slate-700'}`}>
              🔄 Rewrite Loop {rewrite.applied ? `✓ +${rewrite.gain}P` : '(kein Gewinn)'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Original</div>
                <div className="font-medium text-gray-800">"{rewrite.originalHeadline}"</div>
                <div className="text-xs text-gray-500 mt-1">Performance: {rewrite.beforePerformance}/30</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  {rewrite.applied ? 'Angewendet' : 'Bester Kandidat (nicht besser)'}
                </div>
                <div className={`font-medium ${rewrite.applied ? 'text-emerald-800' : 'text-gray-800'}`}>
                  "{rewrite.finalHeadline}"
                </div>
                <div className="text-xs text-gray-500 mt-1">Performance: {rewrite.afterPerformance}/30</div>
              </div>
            </div>
            {Array.isArray(rewrite.candidates) && rewrite.candidates.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                  Alle {rewrite.candidates.length} Kandidaten anzeigen
                </summary>
                <ul className="mt-2 space-y-1">
                  {rewrite.candidates.map((c: any, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="font-mono text-gray-400 w-8">{c.performance}P</span>
                      <span className="text-gray-700">"{c.text}"</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-3 text-[11px] text-gray-500">
              Dauer: {rewrite.durationMs}ms
            </div>
          </div>
        )}

        {/* Raw JSON */}
        <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            🔍 Raw Breakdown JSON (für Debugging)
          </summary>
          <pre className="mt-4 bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs">
            {JSON.stringify({
              headline: dashboard.headlineMetrics,
              freshness: dashboard.freshnessMetrics,
              content: dashboard.contentMetrics,
              image: dashboard.imageMetrics,
              trust: dashboard.trustMetrics,
              primaryBlockers: dashboard.primaryBlockers,
              improvementHints: dashboard.improvementHints,
            }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function CategoryCard({
  emoji,
  title,
  score,
  max,
  verdict,
  checks,
  reasons,
}: {
  emoji: string;
  title: string;
  score: number;
  max: number;
  verdict?: 'PASS' | 'FAIL';
  checks: { label: string; ok?: boolean; neutral?: boolean }[];
  reasons?: string[];
}) {
  const ratio = max > 0 ? score / max : 0;
  const barColor = ratio >= 0.8 ? 'bg-green-500' : ratio >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
  const scoreTextColor = ratio >= 0.8 ? 'text-green-700' : ratio >= 0.5 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5" data-testid={`category-card-${title.toLowerCase().replace(/[^a-z]/g, '-')}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          {title}
        </h3>
        <div className={`font-bold text-lg ${scoreTextColor}`}>
          {score}<span className="text-gray-400 text-sm">/{max}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${ratio * 100}%` }} />
      </div>

      {/* Checks */}
      <ul className="space-y-1.5 text-sm">
        {checks.map((check, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {check.neutral ? (
              <span className="h-4 w-4 text-gray-400 text-xs">ℹ</span>
            ) : check.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
            <span className={check.neutral ? 'text-gray-600' : check.ok ? 'text-gray-700' : 'text-gray-500'}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>

      {reasons && reasons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
          {reasons.map((reason, idx) => (
            <div key={idx}>· {reason}</div>
          ))}
        </div>
      )}
    </div>
  );
}
