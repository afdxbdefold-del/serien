'use client';

import { useEffect, useRef } from 'react';

interface ContentWithAdsProps {
  html: string;
  className?: string;
  adSlot?: string;
  paragraphInterval?: number; // Ad after every X paragraphs
}

/**
 * Renders article content with ads inserted between paragraphs
 */
export default function ContentWithAds({ 
  html, 
  className = '',
  adSlot = 'CONTENT_AD_SLOT',
  paragraphInterval = 3 // Ad after every 3 paragraphs
}: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Find all paragraphs and headings
    const elements = containerRef.current.querySelectorAll('p, h2, h3');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 3; // Maximum ads to insert

    elements.forEach((el) => {
      // Only count paragraphs, not headings
      if (el.tagName === 'P') {
        paragraphCount++;
      }

      // Insert ad after every X paragraphs (but not after headings)
      if (paragraphCount > 0 && paragraphCount % paragraphInterval === 0 && el.tagName === 'P' && adsInserted < maxAds) {
        // Check if ad already exists after this element
        const nextEl = el.nextElementSibling;
        if (nextEl && nextEl.classList.contains('content-ad-unit')) {
          return; // Already has an ad
        }

        // Create ad container
        const adContainer = document.createElement('div');
        adContainer.className = 'content-ad-unit my-6 flex justify-center';
        adContainer.innerHTML = `
          <ins class="adsbygoogle"
               style="display:block; min-height:100px;"
               data-ad-client="ca-pub-8583619451045805"
               data-ad-slot="${adSlot}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        `;

        // Insert after paragraph
        el.after(adContainer);
        adsInserted++;

        // Push ad
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('Ad error:', e);
        }
      }
    });
  }, [html, adSlot, paragraphInterval]);

  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
