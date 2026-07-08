'use client';

/**
 * GlobalDesktopAds
 *
 * Rendert die POSITIONSGEBUNDENEN Desktop-Ad-Slots — d.h. die Slots, die
 * NICHT an spezifischen Content-Blöcken hängen, sondern an festen
 * Bildschirm-/Layout-Positionen. Diese Slots gehören daher NICHT in eine
 * spezifische Page-Komponente (z.B. `app/[slug]/page.tsx`), sondern in den
 * globalen LayoutWrapper — damit sie auf ALLEN Public-Seiten erscheinen
 * (Homepage, Streamer-Landingpages, Genre-Seiten, Autoren, Artikel, etc.).
 *
 * Content-abhängige Slots (`desktop_megabanner_top`, `_bottom`, `in_content`,
 * `desktop_bottom_rect`, `desktop_sidebar_halfpage`) bleiben bewusst auf
 * der Artikelseite, weil sie zwischen Content-Blöcken sitzen.
 *
 * ALLE Slots sind ausschließlich Desktop (User-Vorgabe):
 *   - Billboard Header:   ≥ lg  (1024 px)
 *   - Skyscraper l/r:     ≥ xl  (1280 px), damit sie nicht mit dem
 *                                zentrierten 1000 px-Container kollidieren
 *   - Corner Video:       ≥ lg  (1024 px)
 *   - Footer Slide-in:    ≥ lg  (1024 px)
 *
 * `empty:hidden` sorgt dafür, dass leere Wrapper (inaktiver Slot →
 * ClientAdSlot rendert null) komplett kollabieren — keine leeren
 * Layout-Löcher.
 */

import ClientAdSlot from './ClientAdSlot';

export default function GlobalDesktopAds() {
  return (
    <>
      {/* Billboard Header — 970×250. Sitzt direkt unter dem Header,
          zentriert, volle Bildschirmbreite. */}
      <div
        className="hidden lg:flex w-full justify-center pt-4 pb-2 px-4 empty:hidden empty:!pt-0 empty:!pb-0"
        data-ad-slot-wrapper="desktop_billboard_header"
      >
        <ClientAdSlot position="desktop_billboard_header" />
      </div>

      {/* Skyscraper links — 160×600. Fixed am linken Viewport-Rand,
          nur ab xl (1280 px) sichtbar, damit er nicht mit dem 1000 px-
          Content-Container kollidiert. */}
      <aside
        className="hidden xl:block fixed left-2 2xl:left-6 top-24 z-30 w-[160px] empty:hidden"
        aria-label="Werbung Skyscraper links"
        data-ad-slot-wrapper="desktop_skyscraper_left"
      >
        <ClientAdSlot position="desktop_skyscraper_left" />
      </aside>

      {/* Skyscraper rechts — 160×600. Fixed am rechten Viewport-Rand. */}
      <aside
        className="hidden xl:block fixed right-2 2xl:right-6 top-24 z-30 w-[160px] empty:hidden"
        aria-label="Werbung Skyscraper rechts"
        data-ad-slot-wrapper="desktop_skyscraper_right"
      >
        <ClientAdSlot position="desktop_skyscraper_right" />
      </aside>

      {/* Corner Video — 320×180. Fixed rechts unten. z-40 (über
          Footer-Slidein), da beide gleichzeitig aktiv sein können. */}
      <div
        className="hidden lg:block fixed bottom-4 right-4 z-40 pointer-events-auto empty:hidden"
        aria-label="Werbung Corner Video"
        data-ad-slot-wrapper="desktop_corner_video"
      >
        <ClientAdSlot position="desktop_corner_video" />
      </div>

      {/* Footer Slide-in — 728×90. Fixed am unteren Bildschirmrand,
          zentriert, volle Bildschirmbreite. */}
      <div
        className="hidden lg:flex fixed bottom-0 left-0 right-0 z-30 justify-center pointer-events-auto empty:hidden"
        aria-label="Werbung Footer Slide-in"
        data-ad-slot-wrapper="desktop_footer_slidein"
      >
        <ClientAdSlot position="desktop_footer_slidein" />
      </div>
    </>
  );
}
