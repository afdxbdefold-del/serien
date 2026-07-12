'use client';

/**
 * InfeedAdCard — In-Feed Werbeanzeige für alle Card-Grids (News, Autor,
 * Figur, Person, Article-Related). Visuell identisch zur jeweiligen
 * Content-Card (Rundung, Border, Hintergrund) damit der Grid-Rhythmus
 * nicht bricht. Höhe NICHT hart-fixiert — das Ad-Network bestimmt die
 * Creative-Größe selbst. `empty:hidden` sorgt für Kollaps bei inaktivem
 * Slot. `hidden md:flex` = auf Mobile komplett unsichtbar (User-Vorgabe).
 *
 * Position-Name konfigurierbar — Default `news_infeed`, damit alle
 * Grids einen gemeinsamen High-Fill-Slot teilen.
 */

import ClientAdSlot from './ClientAdSlot';

interface InfeedAdCardProps {
  position?: string;
}

export default function InfeedAdCard({ position = 'news_infeed' }: InfeedAdCardProps) {
  return (
    <div
      className="hidden md:flex bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden items-center justify-center min-h-[280px] empty:hidden"
      data-ad-slot-wrapper={position}
      aria-label="Werbeanzeige"
    >
      <ClientAdSlot position={position} />
    </div>
  );
}
