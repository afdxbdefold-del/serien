'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Sticky Bottom Ad with iframe reload
 */
export default function StickyBottomAd() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pathname = usePathname();

  // Reload iframe on navigation
  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const currentSrc = iframe.src;
    iframe.src = '';
    setTimeout(() => {
      iframe.src = currentSrc;
    }, 50);
  }, [pathname]);

  const adHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8583619451045805" crossorigin="anonymous"></script>
      <style>body{margin:0;padding:0;overflow:hidden;}</style>
    </head>
    <body>
      <ins class="adsbygoogle"
        style="display:inline-block;width:320px;height:100px"
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="3358622315"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </body>
    </html>
  `;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      id="sticky-bottom-ad"
    >
      <iframe
        ref={iframeRef}
        srcDoc={adHtml}
        width={320}
        height={100}
        style={{ border: 'none', overflow: 'hidden' }}
        scrolling="no"
      />
    </div>
  );
}
