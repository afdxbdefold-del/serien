'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AdUnitProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * AdUnit with iframe reload on navigation
 * Creates an iframe that reloads on route change to refresh ads
 */
export default function AdUnit({ slot, width, height, className = '' }: AdUnitProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd) return;

    // Reload iframe on navigation
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const currentSrc = iframe.src;
      iframe.src = '';
      setTimeout(() => {
        iframe.src = currentSrc;
      }, 50);
    }
  }, [pathname]);

  // Show placeholder in development/preview
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname.includes('preview'))) {
    return (
      <div className={`ad-container ${className}`}>
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            Werbeanzeige
          </p>
        </div>
      </div>
    );
  }

  // Create ad HTML for iframe
  const adHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8583619451045805" crossorigin="anonymous"></script>
      <style>body{margin:0;padding:0;overflow:hidden;}</style>
    </head>
    <body>
      <ins class="adsbygoogle"
        style="display:inline-block;width:${width}px;height:${height}px"
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="${slot}"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </body>
    </html>
  `;

  return (
    <div className={`ad-container ${className}`}>
      <iframe
        ref={iframeRef}
        srcDoc={adHtml}
        width={width}
        height={height}
        style={{ border: 'none', overflow: 'hidden' }}
        scrolling="no"
      />
    </div>
  );
}
