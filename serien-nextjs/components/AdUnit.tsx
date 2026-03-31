'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AdUnitProps {
  slot: string;
  width?: number;
  height?: number;
  format?: string;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

function AdUnitInner({ slot, width, height }: { slot: string; width: number; height: number }) {
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
      style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
      data-ad-client="ca-pub-8583619451045805"
      data-ad-slot={slot}
    />
  );
}

export default function AdUnit({ slot, width = 728, height = 90, className = '' }: AdUnitProps) {
  const pathname = usePathname();

  if (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname.includes('preview'))) {
    return (
      <div className={`ad-container ${className}`} data-testid={`ad-unit-${slot}`}>
        <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">Werbeanzeige ({width}x{height})</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-container ${className}`} data-testid={`ad-unit-${slot}`}>
      <AdUnitInner key={`${pathname}-${slot}`} slot={slot} width={width} height={height} />
    </div>
  );
}
