'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { injectHtmlWithScripts, pickAdVariant } from '@/lib/ad-html-injector';
import {
  fetchAdSlots,
  pickSlotForViewport,
  isMobileViewport,
  type AdConfig,
} from '@/lib/ad-slots-client';

interface ClientAdSlotProps {
  position: string;
  className?: string;
}

/**
 * AdSlotInner: Rendert den Custom-HTML-Slot (TheMoneytizer, Plista,
 * Outbrain, AWIN, Direct-Deals). AdSense-Pfad wurde Feb 2026 entfernt —
 * alle Slots laufen jetzt über `provider='custom'`.
 *
 * `key={pathname}` auf dem umgebenden Wrapper sorgt dafür, dass bei SPA-
 * Navigation ein sauberer Remount stattfindet, sodass Ad-Networks pro
 * Route eine frische Auction bekommen.
 */
function AdSlotInner({ config }: { config: AdConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || config.provider !== 'custom') return;

    const variants = config.customHtmlVariants || [];
    const picked = pickAdVariant(variants, config.rotationMode || 'random');
    if (picked) {
      injectHtmlWithScripts(container, picked.html);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [config]);

  return <div ref={containerRef} />;
}

/**
 * ClientAdSlot: Route-aware Ad-Container. Fetcht die Slot-Config aus dem
 * Admin (DB-backed via /api/ads/slots), pickt die Device-Variante (Mobile
 * vs. Desktop) und rendert den Slot. Bei inaktivem Slot oder fehlender
 * Config wird `null` gerendert — das umgebende `empty:hidden` sorgt dafür
 * dass keine Ghost-Container im Layout stehen.
 */
export default function ClientAdSlot({ position, className = '' }: ClientAdSlotProps) {
  const pathname = usePathname();
  const [config, setConfig] = useState<AdConfig | null>(null);

  useEffect(() => {
    // Mobile-Sperre: auf Mobile (< 768 px) werden GAR KEINE Ads
    // ausgeliefert (User-Vorgabe Feb 2026). Slot bleibt hier stumm.
    if (isMobileViewport()) return;
    fetchAdSlots().then((slots) => {
      setConfig(pickSlotForViewport(slots, position, false));
    });
  }, [position]);

  if (!config || config.provider !== 'custom') return null;

  return (
    <div
      className={`ad-container flex justify-center ${className}`}
      data-ad-position={position}
      data-ad-device={config.device}
      data-testid={`ad-slot-${position}`}
    >
      <AdSlotInner key={`${pathname}-${position}`} config={config} />
    </div>
  );
}
