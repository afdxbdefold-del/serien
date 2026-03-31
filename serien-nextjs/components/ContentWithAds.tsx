'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface ContentWithAdsProps {
  html: string;
  className?: string;
}

interface AdConfig {
  adClient: string;
  adSlot: string;
  width: number;
  height: number;
}

/**
 * Renders article content with ads inserted after every 2nd paragraph.
 * Route-aware: re-injects ads on SPA navigation via usePathname().
 */
export default function ContentWithAds({ 
  html, 
  className = ''
}: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adConfig, setAdConfig] = useState<AdConfig | null>(null);
  const pathname = usePathname();

  // Fetch ad config once
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/ads/slots');
        if (res.ok) {
          const slots = await res.json();
          const inContentConfig = slots['in_content'];
          if (inContentConfig) {
            setAdConfig(inContentConfig);
          }
        }
      } catch (error) {
        console.error('Failed to load in-content ad config:', error);
      }
    };
    loadConfig();
  }, []);

  // Inject ads whenever html changes OR pathname changes (SPA navigation)
  useEffect(() => {
    if (!containerRef.current || !adConfig) return;

    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Remove previously injected ads first
    const oldAds = containerRef.current.querySelectorAll('.content-ad-unit');
    oldAds.forEach(el => el.remove());

    // Find all paragraphs and insert ads
    const paragraphs = containerRef.current.querySelectorAll('p');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 4;

    paragraphs.forEach((el) => {
      paragraphCount++;

      if (paragraphCount % 2 === 0 && adsInserted < maxAds) {
        const adContainer = document.createElement('div');
        adContainer.className = 'content-ad-unit my-6 not-prose';
        adContainer.setAttribute('data-ad-position', 'in_content');
        adContainer.style.cssText = 'display:flex;justify-content:center;';
        adContainer.innerHTML = `
          <ins class="adsbygoogle"
               style="display:inline-block;width:${adConfig.width}px;height:${adConfig.height}px"
               data-ad-client="${adConfig.adClient}"
               data-ad-slot="${adConfig.adSlot}"></ins>
        `;

        el.after(adContainer);
        adsInserted++;

        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          // AdSense push error
        }
      }
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
