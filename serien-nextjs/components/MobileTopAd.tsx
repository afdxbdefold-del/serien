'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { injectHtmlWithScripts, pickAdVariant } from '@/lib/ad-html-injector';
import { fetchAdSlots, isMobileViewport, type AdConfig } from '@/lib/ad-slots-client';

/**
 * MobileTopAd — Mobile-only Ad direkt unter dem Header. Nutzt jetzt
 * (Feb 2026, AdSense-Removal) den Custom-HTML-Pfad (TheMoneytizer etc.),
 * exakt wie ClientAdSlot.
 */
function MobileAdInner({ config }: { config: AdConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || config.provider !== 'custom') return;

    const variants = config.customHtmlVariants || [];
    const picked = pickAdVariant(variants, config.rotationMode || 'random');
    if (picked) {
      injectHtmlWithScripts(container, picked.html);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [config]);

  return <div ref={containerRef} />;
}

export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isMobileViewport()) return;
    fetchAdSlots()
      .then((slots) => {
        const cfg = slots.mobile['mobile_top'];
        if (cfg && cfg.provider === 'custom') setConfig(cfg);
      })
      .catch((err) => console.error('Failed to load mobile_top ad config:', err));
  }, []);

  if (!config) return null;

  return (
    <div className="lg:hidden flex justify-center" data-testid="mobile-top-ad">
      <MobileAdInner key={`mobile-top-${pathname}`} config={config} />
    </div>
  );
}
