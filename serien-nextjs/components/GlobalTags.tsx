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
 * Die Tags werden als RAW-HTML emittiert (`dangerouslySetInnerHTML`),
 * damit `<script>`-Tags vom Browser nativ geparst werden — `Next/Script`-
 * Wrapping würde Lifecycle-Konflikte mit externen Ad-Loadern erzeugen.
 *
 * Bot-Filter (`isBotUserAgent`) wird in `getGlobalTagsFor` angewendet.
 */
import { headers } from 'next/headers';
import { getGlobalTagsFor, type Placement } from '@/lib/global-tags';

export default async function GlobalTags({ placement }: { placement: Placement }) {
  const h = await headers();
  const ua = h.get('user-agent');
  const tags = await getGlobalTagsFor(placement, ua);

  if (tags.length === 0) return null;

  return (
    <>
      {tags.map((t) => (
        <div
          key={t.id}
          data-global-tag={t.name}
          data-placement={placement}
          dangerouslySetInnerHTML={{ __html: t.html }}
        />
      ))}
    </>
  );
}
