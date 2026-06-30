'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { fetchAdSlots, isMobileViewport, type AdConfig } from '@/lib/ad-slots-client';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

function MobileAdInner({ config }: { config: AdConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    container.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'inline-block';
    ins.style.width = `${config.width}px`;
    ins.style.height = `${config.height}px`;
    ins.setAttribute('data-ad-client', config.adClient);
    ins.setAttribute('data-ad-slot', config.adSlot);
    container.appendChild(ins);

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // ignore
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      container.innerHTML = '';
    };
  }, [config]);

  return <div ref={containerRef} />;
}

/**
 * MobileTopAd ist per Definition nur fürs Mobile-Bucket — der Wrapper
 * hat `lg:hidden`, also nur sichtbar < 1024 px. Wir greifen explizit
 * auf `slots.mobile['mobile_top']`. Desktop bekommt KEINEN Slot hier
 * (eine etwaige Desktop-Variante des `mobile_top`-Codes existiert
 * standardmäßig nicht — wäre sowieso versteckt durch `lg:hidden`).
 */
export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isMobileViewport()) return;
    fetchAdSlots()
      .then((slots) => {
        const cfg = slots.mobile['mobile_top'];
        if (cfg) setConfig(cfg);
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
