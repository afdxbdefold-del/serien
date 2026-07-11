'use client';

/**
 * ThemePageSidebar
 *
 * In-Flow Sidebar für Themenseiten (Streamer-Landings, Genre-Seiten,
 * Top-Listen, Übersichten). Struktur IDENTISCH zur Homepage-Sidebar und
 * zur Artikelseiten-Sidebar — dreiteiliger sticky Ad-Stack:
 *
 *   1. desktop_sidebar_top_rect  (MPU 300×250)
 *   2. desktop_sidebar_halfpage  (300×600)
 *   3. desktop_sidebar_megasky   (300×600+)
 *
 * Rendert nur auf Desktop (≥ lg = 1024 px). Ist unter lg unsichtbar,
 * Content nimmt dort 100% Breite.
 *
 * WICHTIG: Diese Komponente wird nicht direkt in Themenseiten importiert.
 * Der LayoutWrapper wickelt `<main>` bei Themenseiten mit einem Grid,
 * dessen zweite Column diese Sidebar rendert — damit müssen die
 * einzelnen ~30 Themenseiten nicht angefasst werden.
 */

import ClientAdSlot from './ClientAdSlot';

export default function ThemePageSidebar() {
  return (
    <aside
      className="hidden lg:block"
      aria-label="Werbung Sidebar (Themenseite)"
      data-context="theme-sidebar"
    >
      <div className="sticky top-24 space-y-4">
        <div data-ad-slot-wrapper="desktop_sidebar_top_rect" className="empty:hidden">
          <ClientAdSlot position="desktop_sidebar_top_rect" />
        </div>
        <div data-ad-slot-wrapper="desktop_sidebar_halfpage" className="empty:hidden">
          <ClientAdSlot position="desktop_sidebar_halfpage" />
        </div>
        <div data-ad-slot-wrapper="desktop_sidebar_megasky" className="empty:hidden">
          <ClientAdSlot position="desktop_sidebar_megasky" />
        </div>
        <div data-ad-slot-wrapper="desktop_sidebar_megasky_2" className="empty:hidden">
          <ClientAdSlot position="desktop_sidebar_megasky_2" />
        </div>
      </div>
    </aside>
  );
}
