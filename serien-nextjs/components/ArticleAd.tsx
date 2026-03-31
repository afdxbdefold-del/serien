'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface ArticleAdProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Article Ad with iframe reload on navigation
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
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
    <div className={`flex justify-center ${className}`}>
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
