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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Create fresh <ins> via raw DOM (not React JSX)
    container.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    // Responsive: block + 100% width + max-height hint prevents mobile overflow.
    // Google AdSense will pick an appropriate ad size up to (width × height).
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.style.maxWidth = `${width}px`;
    ins.style.height = 'auto';
    ins.style.minHeight = `${Math.min(height, 90)}px`;
    ins.setAttribute('data-ad-client', 'ca-pub-8583619451045805');
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    container.appendChild(ins);

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // ignore
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      container.innerHTML = '';
    };
  }, [slot, width, height]);

  return <div ref={containerRef} className="w-full" />;
}

export default function AdUnit({ slot, width = 728, height = 90, className = '' }: AdUnitProps) {
  const pathname = usePathname();

  if (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname.includes('preview'))) {
    return (
      <div
        className={`ad-container w-full overflow-hidden ${className}`}
        data-testid={`ad-unit-${slot}`}
        style={{ maxWidth: `${width}px`, marginLeft: 'auto', marginRight: 'auto' }}
      >
        <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">Werbeanzeige ({width}x{height})</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ad-container w-full overflow-hidden ${className}`}
      data-testid={`ad-unit-${slot}`}
      style={{ maxWidth: `${width}px`, marginLeft: 'auto', marginRight: 'auto' }}
    >
      <AdUnitInner key={`${pathname}-${slot}`} slot={slot} width={width} height={height} />
    </div>
  );
}
