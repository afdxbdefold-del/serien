'use client';

/**
 * NewsAdCard — In-Feed Werbeanzeige innerhalb des /news-Grids.
 *
 * Visuell identisch zur NewsCard (gleicher Card-Chrome: Rundung, Border,
 * Hintergrund) damit der Grid-Rhythmus nicht bricht. Höhe ist NICHT
 * hart-fixiert — das Ad-Netzwerk (TheMoneytizer / AdSense) bestimmt die
 * Creative-Größe selbst. `empty:hidden` sorgt dafür, dass die Card bei
 * inaktivem Slot vollständig kollabiert (kein leerer Grid-Slot).
 *
 * Position-Name `news_infeed` — DB muss Slot mit device='desktop' und/oder
 * 'mobile' hinterlegen (ClientAdSlot pickt via Viewport-Check).
 */

import ClientAdSlot from '@/components/ClientAdSlot';

export default function NewsAdCard() {
  return (
    <div
      className="hidden md:flex bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden items-center justify-center min-h-[280px] empty:hidden"
      data-ad-slot-wrapper="news_infeed"
      aria-label="Werbeanzeige"
    >
      <ClientAdSlot position="news_infeed" />
    </div>
  );
}
