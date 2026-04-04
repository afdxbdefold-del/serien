'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdConfig {
  adClient: string;
  adSlot: string;
  width: number;
  height: number;
  mobileOnly: boolean;
  desktopOnly: boolean;
}

function MobileAdInner({ config }: { config: AdConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Create fresh <ins> via raw DOM
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
      } catch (e) {
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

export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/ads/slots');
        if (res.ok) {
          const slots = await res.json();
          if (slots['mobile_top']) {
            setConfig(slots['mobile_top']);
          }
        }
      } catch (error) {
        console.error('Failed to load ad config:', error);
      }
    };
    loadConfig();
  }, []);

  if (!config) return null;

  return (
    <div className="lg:hidden flex justify-center" data-testid="mobile-top-ad">
      <MobileAdInner key={`mobile-top-${pathname}`} config={config} />
    </div>
  );
}
