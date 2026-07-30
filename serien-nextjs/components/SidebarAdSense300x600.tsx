'use client';

/**
 * SidebarAdSense300x600 — Desktop-only Google AdSense 300×600 Half-Page Slot.
 *
 * Ersetzt seit Feb 2026 den Yieldlab-Prebid-Testslot in der Artikel-
 * Sidebar (User-Direktive, siehe app/[slug]/page.tsx).
 *
 * Verhalten:
 *  • Lädt AdSense-Loader idempotent (nur einmal pro Seite).
 *  • Rendert <ins class="adsbygoogle"> mit fixen 300×600 (nicht responsive,
 *    weil der Slot exakt Half-Page ist).
 *  • Triggert `adsbygoogle.push({})` beim Mount, sodass AdSense den Slot
 *    füllt. `key`-Prop vom Parent (z.B. Artikel-Slug) sorgt für Remount
 *    bei SPA-Navigation.
 *
 * Sichtbarkeit: Der Slot ist Desktop-only. Die Sichtbarkeitssteuerung
 * erfolgt beim Aufrufer über einen `hidden lg:block`-Container. Diese
 * Komponente selbst enthält kein Media-Query, damit die Größe fix bleibt.
 */

import { useEffect, useRef } from 'react';

const ADSENSE_CLIENT = 'ca-pub-8583619451045805';
const ADSENSE_SLOT = '5695618723';
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function ensureAdSenseLoader(): void {
  if (document.querySelector(`script[data-adsense-loader="${ADSENSE_CLIENT}"]`)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = ADSENSE_SRC;
  s.crossOrigin = 'anonymous';
  s.setAttribute('data-adsense-loader', ADSENSE_CLIENT);
  document.head.appendChild(s);
}

export default function SidebarAdSense300x600() {
  const pushedRef = useRef(false);

  useEffect(() => {
    ensureAdSenseLoader();
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // AdSense-Loader noch nicht bereit – Push in nächstem Tick nachholen.
      setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          /* stumm */
        }
      }, 800);
      console.warn('[adsense-300x600] push retry scheduled', err);
    }
  }, []);

  return (
    <div
      data-testid="sidebar-adsense-300x600"
      style={{ width: 300, minHeight: 600 }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: 300, height: 600 }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
      />
    </div>
  );
}
