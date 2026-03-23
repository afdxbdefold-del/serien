'use client';

import { useEffect, useRef } from 'react';

interface ContentWithAdsProps {
  html: string;
  className?: string;
}

/**
 * Renders article content with ads inserted after every 2nd paragraph
 * Ad size: 336x280
 */
export default function ContentWithAds({ 
  html, 
  className = ''
}: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Find all paragraphs
    const paragraphs = containerRef.current.querySelectorAll('p');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 4; // Maximum ads to insert

    paragraphs.forEach((el) => {
      paragraphCount++;

      // Insert ad after every 2nd paragraph
      if (paragraphCount % 2 === 0 && adsInserted < maxAds) {
        // Check if ad already exists after this element
        const nextEl = el.nextElementSibling;
        if (nextEl && nextEl.classList.contains('content-ad-unit')) {
          return;
        }

        // Create ad container
        const adContainer = document.createElement('div');
        adContainer.className = 'content-ad-unit my-6 flex justify-center';
        adContainer.innerHTML = `
          <ins class="adsbygoogle"
               style="display:inline-block;width:336px;height:280px"
               data-ad-client="ca-pub-8583619451045805"
               data-ad-slot="9591890570"></ins>
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
  }, [html]);

  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
