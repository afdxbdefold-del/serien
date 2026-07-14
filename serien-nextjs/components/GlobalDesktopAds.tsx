'use client';

/**
 * GlobalDesktopAds — hardcoded TheMoneytizer Ad-Slots.
 *
 * Rendert auf ALLEN Public-Seiten (nicht Legal/Admin/AdTest) die globalen
 * TMN-Formate, die layout-unabhängig sind:
 *
 *   • Format 31 — Billboard              (oberhalb Content, zentriert)
 *   • Format 20 — Double Megasky Floating (fixed right, sticky)
 *   • Format 38 — Corner Video           (fixed bottom-right, via CornerVideoTMN)
 *   • Format 6  — Footer Slide-in         (fixed bottom, zentriert)
 *
 * Alle nur Desktop (≥ lg = 1024 px), Mobile-Sperre zusätzlich per matchMedia
 * innerhalb der Widget-Komponenten.
 *
 * KEIN DB-Fetch mehr — alle Slots hardgecodet, damit sie nicht aus Versehen
 * im Admin deaktiviert werden können.
 */
import CornerVideoTMN from './CornerVideoTMN';
import TMNBillboard from './TMNBillboard';
import TMNSlideInFooter from './TMNSlideInFooter';
import TMNDoubleMegasky from './TMNDoubleMegasky';

export default function GlobalDesktopAds() {
  return (
    <>
      {/* 1. Billboard (Format 31) — direkt unter dem Header, volle Breite,
          zentriert. Erster Ad-Kontakt beim Pageload. */}
      <TMNBillboard />

      {/* 2. Double Megasky Floating (Format 20) — fixed rechts,
          top-Offset für Header-Höhe. Positionierung kommt vom TMN-Widget
          selbst (siehe eingebettetes <style>). Auf Bildschirmen ≥ xl
          nur sinnvoll, weil sonst Content-Overlay. */}
      <TMNDoubleMegasky />

      {/* 3. Corner Video (Format 38) — fixed bottom-right, 320×180. */}
      <div
        className="hidden lg:block fixed bottom-4 right-4 z-40 pointer-events-auto"
        aria-label="Werbung Corner Video"
        data-tmn-slot-wrapper="corner-video"
      >
        <CornerVideoTMN />
      </div>

      {/* 4. Footer Slide-in (Format 6) — fixed am unteren Bildschirmrand,
          zentriert, ganze Breite. */}
      <TMNSlideInFooter />
    </>
  );
}
