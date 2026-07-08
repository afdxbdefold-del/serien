'use client';

/**
 * ThemePageAds
 *
 * Rendert zusätzliche Inline-Ad-Slots für "Themen-/Landing-Pages" —
 * also alle Public-Seiten, die KEINE der folgenden Kategorien sind:
 *   - Homepage (`/`) — hat schon eigenen Inline-Ad-Stack (HomeClient)
 *   - Artikeldetail (`isArticlePage`) — hat schon eigenen Ad-Stack im
 *     Grid-Layout (`app/[slug]/page.tsx`)
 *   - Legal-/Konto-Seiten (impressum, datenschutz, nutzungsbedingungen,
 *     redaktionelle-richtlinien, about, einstellungen) — dort bewusst
 *     KEINE zusätzlichen Content-Ads, nur globale Slots.
 *   - Admin (`/admin/*`) und Ad-Test-Routen (`/adtest-*`) — komplett aus
 *     der Werbe-Auslieferung raus (bereits im LayoutWrapper gehandled).
 *
 * Ergibt sich als "alle anderen": Streamer-Landings (netflix-serien,
 * prime-video-serien, disney-plus-serien, …), Genre-Seiten
 * (beste-crime-serien, beste-comedy-serien, …), Top-Listen (top-10,
 * top-100-*, in-90-tagen-zum-altar, the-walking-dead, …), Trend-/News-
 * /Serien-Übersichten (trending, news, serien, neue-serien, figuren,
 * personen, serienfinder, kalender, autoren).
 *
 * Enthaltene Slots — bewusst nur die Inline-Container, die layout-neutral
 * sind (kein Sidebar-Grid nötig):
 *
 *   TOP:    `desktop_megabanner_top`     (728×250 zentriert unter Header)
 *   BOTTOM: `desktop_megabanner_bottom`  (728×250 zentriert vor Footer)
 *
 * Ein zusätzlicher `in_content`-Slot in der Mitte der Seite ist nicht
 * möglich ohne in die jeweilige Themenseiten-Komponente einzugreifen,
 * weil "die Mitte" strukturabhängig ist.
 */

import ClientAdSlot from './ClientAdSlot';

export function ThemePageAdTop() {
  return (
    <div
      className="hidden lg:flex w-full justify-center pt-4 pb-2 px-4 empty:hidden empty:!pt-0 empty:!pb-0"
      data-ad-slot-wrapper="desktop_megabanner_top"
      data-context="theme-page"
    >
      <ClientAdSlot position="desktop_megabanner_top" />
    </div>
  );
}

export function ThemePageAdBottom() {
  return (
    <div
      className="hidden lg:flex w-full justify-center pt-6 pb-4 px-4 empty:hidden empty:!pt-0 empty:!pb-0"
      data-ad-slot-wrapper="desktop_megabanner_bottom"
      data-context="theme-page"
    >
      <ClientAdSlot position="desktop_megabanner_bottom" />
    </div>
  );
}
