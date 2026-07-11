'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { injectHtmlWithScripts, pickAdVariant } from '@/lib/ad-html-injector';
import { fetchAdSlots, isMobileViewport, type AdConfig } from '@/lib/ad-slots-client';

interface ContentWithAdsProps {
  html: string;
  className?: string;
}

/**
 * Rendert Artikel-Content mit Custom-HTML-Ads zwischen den Absätzen.
 * Route-aware: bei SPA-Navigation werden die Ads via `pathname`-Trigger
 * neu injiziert. AdSense-Pfad wurde Feb 2026 entfernt — alle In-Content-
 * Ads laufen jetzt über `provider='custom'` (TheMoneytizer etc.).
 */
export default function ContentWithAds({ html, className = '' }: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adConfig, setAdConfig] = useState<AdConfig | null>(null);
  const pathname = usePathname();

  // Slot-Config einmalig fetchen. Mobile-Sperre: KEINE Ads auf Mobile
  // (User-Vorgabe Feb 2026). Ergo nur Desktop-in_content laden.
  useEffect(() => {
    if (isMobileViewport()) return;
    fetchAdSlots()
      .then((slots) => {
        const cfg = slots.desktop['in_content'];
        if (cfg && cfg.provider === 'custom') setAdConfig(cfg);
      })
      .catch((err) => console.error('Failed to load in-content ad config:', err));
  }, []);

  // Ads injecten wenn html oder pathname wechselt.
  useEffect(() => {
    if (!containerRef.current || !adConfig) return;

    // Alte Ads entfernen (SPA-Navigation-Cleanup).
    const oldAds = containerRef.current.querySelectorAll('.content-ad-unit');
    oldAds.forEach((el) => el.remove());

    // Nach jedem 4. Absatz einen Ad einfügen, maximal 2.
    const paragraphs = containerRef.current.querySelectorAll('p');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 2;
    const insertEveryNth = 4;

    paragraphs.forEach((el) => {
      paragraphCount++;
      if (paragraphCount % insertEveryNth !== 0 || adsInserted >= maxAds) return;

      const variants = adConfig.customHtmlVariants || [];
      const picked = pickAdVariant(variants, adConfig.rotationMode || 'random');
      if (!picked) return;

      const adContainer = document.createElement('div');
      adContainer.className = 'content-ad-unit not-prose';
      adContainer.setAttribute('data-ad-position', 'in_content');
      // Flex-zentriert, keine eigenen Dimensionen — Ad-Network dimensioniert
      // sein Creative selbst.
      adContainer.style.cssText = 'display:flex;justify-content:center;padding:16px 0;';
      el.after(adContainer);
      injectHtmlWithScripts(adContainer, picked.html);
      adsInserted++;
    });
  }, [html, adConfig, pathname]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
