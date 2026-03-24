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
 * Ad configuration loaded from database
 */
export default function ContentWithAds({ 
  html, 
  className = ''
}: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adsInitialized = useRef(false);
  const [adConfig, setAdConfig] = useState<AdConfig | null>(null);

  // Fetch ad config on mount
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

  useEffect(() => {
    if (!containerRef.current || adsInitialized.current || !adConfig) return;
    adsInitialized.current = true;

    // Find all paragraphs
    const paragraphs = containerRef.current.querySelectorAll('p');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 4;
    const adElements: HTMLElement[] = [];

    paragraphs.forEach((el) => {
      paragraphCount++;

      // Insert ad after every 2nd paragraph
      if (paragraphCount % 2 === 0 && adsInserted < maxAds) {
        // Check if ad already exists after this element
        const nextEl = el.nextElementSibling;
        if (nextEl && nextEl.classList.contains('content-ad-unit')) {
          return;
        }

        // Create ad container with config from DB
        const adContainer = document.createElement('div');
        adContainer.className = 'content-ad-unit my-6 flex justify-center not-prose';
        adContainer.setAttribute('data-ad-position', 'in_content');
        adContainer.innerHTML = `
          <ins class="adsbygoogle"
               style="display:inline-block;width:${adConfig.width}px;height:${adConfig.height}px"
               data-ad-client="${adConfig.adClient}"
               data-ad-slot="${adConfig.adSlot}"></ins>
        `;

        // Insert after paragraph
        el.after(adContainer);
        adElements.push(adContainer);
        adsInserted++;
      }
    });

    // Push ads with longer delay between each to prevent conflicts
    // Start at 2000ms to let other ads initialize first
    adElements.forEach((_, index) => {
      setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('Ad error:', e);
        }
      }, 2000 + (index * 400)); // Start at 2s, then 400ms between each
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
