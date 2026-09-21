import { pipelineActionOutcome } from './pipeline-action-outcome';
import { summarizeDraftOutcomes, type DraftOutcome } from './draft-pipeline-reliability';

interface DraftArticleResult extends DraftOutcome {
  articleId?: string;
  slug?: string;
  title?: string;
  draftReason?: string;
}

export function draftPipelineSkipMessage(reason?: string): string {
  switch (reason) {
    case 'pipeline.cron.paused': return 'Die automatische Redaktion ist pausiert. Es wurde nichts generiert.';
    case 'already-running': return 'Diese Pipeline läuft bereits. Es wurde kein zweiter Lauf gestartet.';
    case 'retry-cooldown': return 'Dieser Auftrag wartet nach einem früheren Versuch auf den nächsten erlaubten Lauf.';
    case 'source-too-old': return 'Der Fund liegt außerhalb des automatischen 24-Stunden-Fensters.';
    case 'time-budget': return 'Das Zeitbudget ist erreicht. Verbleibende Aufträge bleiben für den nächsten Lauf erhalten.';
    default: return 'Der Auftrag wurde bereits bearbeitet; es wurde kein neuer Artikel generiert.';
  }
}

export function draftPipelineActionOutcome(result: DraftArticleResult) {
  if (result.articleId && result.slug && result.status) {
    return {
      ...pipelineActionOutcome({
        articleId: result.articleId, slug: result.slug, headline: result.title || result.slug,
        status: result.status, draftReason: result.draftReason, publicationVerified: result.publicationVerified,
      }, !result.skipReason),
      result,
    };
  }
  return {
    success: false, partial: false, created: false, stored: false, published: false,
    skipped: Boolean(result.skipReason), status: result.skipReason ? 'skipped' : 'failed',
    skipReason: result.skipReason,
    message: result.skipReason ? draftPipelineSkipMessage(result.skipReason) : result.error || 'Generierung fehlgeschlagen',
    result,
  };
}

export function draftPipelineBatchOutcome(results: DraftArticleResult[]) {
  const summary = summarizeDraftOutcomes(results);
  const reviewDrafts = results.filter((result) => result.status === 'draft' && result.articleId);
  const existing = results.filter((result) => result.skipReason === 'existing-article').length;
  const firstSkip = results.find((result) => result.skipReason && result.skipReason !== 'existing-article')?.skipReason;
  return {
    ...summary,
    success: summary.success && reviewDrafts.length === 0,
    partial: reviewDrafts.length > 0,
    stored: reviewDrafts.length > 0 || existing > 0,
    skipped: summary.skipped > 0 && summary.articlesCreated === 0 && summary.failed === 0,
    skippedCount: summary.skipped,
    created: summary.articlesCreated,
    alreadyExists: existing,
    status: summary.failed ? 'failed' : reviewDrafts.length ? 'review' : summary.status,
    message: results.length === 0
      ? 'Keine unbearbeiteten Videos gefunden. Es wurde nichts veröffentlicht.'
      : `${summary.published} öffentlich bestätigt, ${summary.drafts} neue Review-Entwürfe, ${existing} bereits vorhanden, ${summary.failed} fehlgeschlagen.${firstSkip ? ` ${draftPipelineSkipMessage(firstSkip)}` : ''}`,
    reviewUrl: reviewDrafts.length > 0 ? '/admin/articles' : undefined,
    results,
  };
}
