interface FetchedSourceTitle {
  headline?: string | null;
  title?: string | null;
}

function usableTitle(value: string | null | undefined): string | null {
  const title = value?.replace(/\s+/g, ' ').trim();
  // The full-text fetcher uses "Article" when the page has no real title.
  if (!title || /^(?:news\s+)?article$/i.test(title)) return null;
  return title;
}

/** Prefer the publisher's title; a URL slug is only a last-resort label. */
export function resolveImportSourceTitle(url: string, fetched: FetchedSourceTitle): string {
  const fetchedTitle = usableTitle(fetched.headline) ?? usableTitle(fetched.title);
  if (fetchedTitle) return fetchedTitle;

  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (segment) {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // A malformed percent escape must not abort an otherwise valid import.
      }
      return usableTitle(decoded.replace(/[-_]+/g, ' ')) ?? 'News Article';
    }
  } catch {
    // URL validation and fetching remain the import route's responsibility.
  }

  return 'News Article';
}
