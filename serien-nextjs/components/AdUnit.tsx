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
    ins.style.display = 'inline-block';
    ins.style.width = `${width}px`;
    ins.style.height = `${height}px`;
    ins.setAttribute('data-ad-client', 'ca-pub-8583619451045805');
    ins.setAttribute('data-ad-slot', slot);
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

  return <div ref={containerRef} />;
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
