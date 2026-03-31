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
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // ignore
      }
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={{ display: 'inline-block', width: `${config.width}px`, height: `${config.height}px` }}
      data-ad-client={config.adClient}
      data-ad-slot={config.adSlot}
    />
  );
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
