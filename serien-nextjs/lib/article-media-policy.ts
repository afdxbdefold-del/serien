/** A series trailer is not evidence for the event reported in a news story.
 * Unknown legacy types fail closed too. News videos need explicit editorial
 * selection; background enrichment must never attach a generic trailer.
 */
export function allowsGenericSeriesTrailer(contentType: string | null | undefined): boolean {
  return ['REVIEW', 'TRAILER', 'PREVIEW', 'RANKING', 'RANKING_LIST', 'EXPLAINER', 'FEATURE', 'FEATURE_ESSAY', 'BACKGROUND', 'EVERGREEN']
    .includes(contentType?.trim().toUpperCase() || '');
}
