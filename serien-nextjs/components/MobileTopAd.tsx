'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AdConfig {
  adClient: string;
  adSlot: string;
  width: number;
  height: number;
  mobileOnly: boolean;
  desktopOnly: boolean;
}

/**
 * Mobile Top Banner Ad with iframe reload
 */
export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isProduction, setIsProduction] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    const loadConfig = async () => {
      try {
        const res = await fetch('/api/ads/slots');
        if (res.ok) {
          const slots = await res.json();
          const mobileTopConfig = slots['mobile_top'];
          if (mobileTopConfig) {
            setConfig(mobileTopConfig);
          }
        }
      } catch (error) {
        console.error('Failed to load mobile top ad config:', error);
      }
    };
    
    loadConfig();
  }, []);

  // Reload iframe on navigation
  useEffect(() => {
    if (!isProduction || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const currentSrc = iframe.src;
    iframe.src = '';
    setTimeout(() => {
      iframe.src = currentSrc;
    }, 50);
  }, [pathname, isProduction]);

  if (!isProduction || !config) {
    return null;
  }

  const adHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adClient}" crossorigin="anonymous"></script>
      <style>body{margin:0;padding:0;overflow:hidden;}</style>
    </head>
    <body>
      <ins class="adsbygoogle"
        style="display:inline-block;width:${config.width}px;height:${config.height}px"
        data-ad-client="${config.adClient}"
        data-ad-slot="${config.adSlot}"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </body>
    </html>
  `;

  return (
    <div className="lg:hidden flex justify-center" data-ad-position="mobile_top">
      <iframe
        ref={iframeRef}
        srcDoc={adHtml}
        width={config.width}
        height={config.height}
        style={{ border: 'none', overflow: 'hidden' }}
        scrolling="no"
      />
    </div>
  );
}
