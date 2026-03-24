'use client';

import { useEffect, useRef, useState } from 'react';

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
 * Renders article content with ads inserted after every 2nd paragraph
 * Ad configuration loaded from database with fallback
 */
export default function ContentWithAds({ 
  html, 
  className = ''
}: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adsInitialized = useRef(false);
  const [adConfig, setAdConfig] = useState<AdConfig>({
    // Default fallback values
    adClient: 'ca-pub-8583619451045805',
    adSlot: '9591890570',
    width: 300,
    height: 250,
  });

  // Fetch ad config on mount (override defaults if found)
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
        console.error('Failed to load in-content ad config, using defaults');
      }
    };
    
    loadConfig();
  }, []);

  useEffect(() => {
    if (!containerRef.current || adsInitialized.current) return;
    adsInitialized.current = true;

    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Find all paragraphs
    const paragraphs = containerRef.current.querySelectorAll('p');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 4;

    paragraphs.forEach((el) => {
      paragraphCount++;

      // Insert ad after every 2nd paragraph
      if (paragraphCount % 2 === 0 && adsInserted < maxAds) {
        // Check if ad already exists after this element
        const nextEl = el.nextElementSibling;
        if (nextEl && nextEl.classList.contains('content-ad-unit')) {
          return;
        }

        // Create ad container with fixed 300x250 size
        const adContainer = document.createElement('div');
        adContainer.className = 'content-ad-unit my-6 not-prose';
        adContainer.setAttribute('data-ad-position', 'in_content');
        adContainer.style.cssText = 'display:flex;justify-content:center;min-height:250px;';
        adContainer.innerHTML = `
          <ins class="adsbygoogle"
               style="display:inline-block;width:${adConfig.width}px;height:${adConfig.height}px"
               data-ad-client="${adConfig.adClient}"
               data-ad-slot="${adConfig.adSlot}"></ins>
        `;

        // Insert after paragraph
        el.after(adContainer);
        adsInserted++;

        // Push ad immediately
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('Ad error:', e);
        }
      }
    });
  }, [html, adConfig]);

  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
