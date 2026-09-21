interface SavedPipelineArticle {
  articleId: string;
  slug: string;
  headline: string;
  status: string;
  publicationVerified?: boolean;
  draftReason?: string;
}

/** A database publication is not proof that the public page rendered correctly. */
export function pipelineActionOutcome(result: SavedPipelineArticle, created = true) {
  const published = result.status === 'published';
  const publicationVerified = published && result.publicationVerified === true;
  const verificationPending = published && !publicationVerified;
  const message = publicationVerified
    ? `Artikel veröffentlicht und öffentliche Anzeige bestätigt: ${result.headline}`
    : verificationPending
      ? `Artikel gespeichert; öffentliche Anzeige noch nicht bestätigt: ${result.headline}. Bitte nicht erneut importieren.`
      : `${created ? 'Review-Entwurf erstellt' : 'Review-Entwurf bereits vorhanden'}: ${result.headline}`;

  return {
    success: publicationVerified,
    partial: !publicationVerified,
    created,
    stored: true,
    alreadyExists: !created,
    published,
    publicationVerified,
    verificationPending,
    status: result.status,
    message,
    articleSlug: result.slug,
    articleTitle: result.headline,
    articleUrl: published ? `/${result.slug}` : undefined,
    draftReason: result.draftReason,
    reviewUrl: published ? undefined : `/admin/articles/${result.articleId}`,
  };
}
