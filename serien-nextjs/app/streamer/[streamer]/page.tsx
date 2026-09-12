import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    streamer: string;
  }>;
}

/**
 * Legacy route. The maintained, filtered landing pages live below
 * /serien/streamer/*; consolidate old URLs there instead of indexing an
 * unfiltered duplicate list for every arbitrary slug.
 */
export default async function LegacyStreamerPage({ params }: PageProps) {
  const { streamer } = await params;
  permanentRedirect(`/serien/streamer/${encodeURIComponent(streamer)}`);
}
