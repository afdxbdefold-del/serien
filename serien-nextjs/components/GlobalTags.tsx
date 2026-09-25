/**
 * Server-Component: rendert aktive globale Tags (Script / iframe / HTML)
 * an einem definierten Placement auf der Artikelseite.
 *
 * Verwendung in `app/[slug]/page.tsx`:
 *
 *   <GlobalTags placement="head" />        ← in <head> emit
 *   <GlobalTags placement="body-start" />  ← oben in <body>
 *   <GlobalTags placement="body-end" />    ← unten in <body>
 *
 * Tags werden erst nach der Desktop-Prüfung aktiviert. Server-HTML darf
 * keine vorzeitig ladenden Scripts, Bilder oder iframes aus diesen Tags enthalten.
 *
 * Bot-Filter (`isBotUserAgent`) wird in `getGlobalTagsFor` angewendet.
 */
import { headers } from 'next/headers';
import { getGlobalTagsFor, type Placement } from '@/lib/global-tags';
import DesktopGlobalTags from './DesktopGlobalTags';

export default async function GlobalTags({ placement }: { placement: Placement }) {
  const h = await headers();
  const ua = h.get('user-agent');
  const tags = await getGlobalTagsFor(placement, ua);

  if (tags.length === 0) return null;

  return <DesktopGlobalTags tags={tags} placement={placement} />;
}
