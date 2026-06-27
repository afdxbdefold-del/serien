/**
 * Ad Components for serien.de
 * 
 * AD RENDERING RULES:
 * - All active ad placements must render immediately on initial page load
 * - No lazy loading or deferred loading
 * - No scroll, click, or interaction required before ads load
 * - Ads must be requested as soon as page renders
 */

import { unstable_cache } from 'next/cache';
import prisma from '@/lib/prisma';

interface AdConfig {
  adClient: string;
  adSlot: string;
  width: number;
  height: number;
  mobileOnly: boolean;
  desktopOnly: boolean;
}

// Cache ad slots for 5 minutes (server-side)
const getCachedAdSlots = unstable_cache(
  async (): Promise<Record<string, AdConfig>> => {
    const slots = await prisma.ad_slots.findMany({
      where: { isActive: true }
    });
    
    const config: Record<string, AdConfig> = {};
    for (const slot of slots) {
      config[slot.position] = {
        adClient: slot.adClient,
        adSlot: slot.adSlot,
        width: slot.width,
        height: slot.height,
        mobileOnly: slot.mobileOnly,
        desktopOnly: slot.desktopOnly,
      };
    }
    return config;
  },
  ['ad-slots'],
  { revalidate: 300 } // 5 minutes
);

interface AdSlotProps {
  position: string;
  className?: string;
}

/**
 * Server Component Ad Slot
 * Renders immediately with page - no client-side loading delay
 */
export async function AdSlot({ position, className = '' }: AdSlotProps) {
  const slots = await getCachedAdSlots();
  const config = slots[position];
  
  if (!config) {
    return null;
  }
  
  // Generate unique ID for this ad instance
  const adId = `ad-${position}-${Date.now()}`;
  
  return (
    <div 
      className={`ad-container flex justify-center ${className}`} 
      data-ad-position={position}
      data-mobile-only={config.mobileOnly}
      data-desktop-only={config.desktopOnly}
    >
      <ins
        id={adId}
        className="adsbygoogle"
        style={{ 
          display: 'inline-block', 
          width: config.width, 
          height: config.height 
        }}
        data-ad-client={config.adClient}
        data-ad-slot={config.adSlot}
      />
      {/* Immediate push - inline script executes synchronously */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var ad = document.getElementById('${adId}');
              if (!ad) return;
              
              // Check device restrictions
              var isMobile = window.innerWidth < 1024;
              var container = ad.parentElement;
              
              if (${config.mobileOnly} && !isMobile) {
                container.style.display = 'none';
                return;
              }
              if (${config.desktopOnly} && isMobile) {
                container.style.display = 'none';
                return;
              }
              
              // Push ad immediately - Google CMP handles consent
              try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
              } catch(e) {
                console.error('Ad push error:', e);
              }
            })();
          `
        }}
      />
    </div>
  );
}

/**
 * Ad Script Loader - Include once in layout head
 * Loads AdSense script immediately, synchronously
 */
export function AdScriptLoader({ adClient }: { adClient: string }) {
  return (
    <>
      {/* Load AdSense script synchronously - no defer/async.
          data-npa-on-unknown-consent="1": Vor Consent / bei Ablehnung
          werden non-personalized Ads geladen (DSGVO/TDDDG-konform). */}
      <script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
        crossOrigin="anonymous"
        data-npa-on-unknown-consent="1"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Initialize adsbygoogle array immediately
            window.adsbygoogle = window.adsbygoogle || [];
            
            // Disable lazy loading for all ads
            (adsbygoogle.requestNonPersonalizedAds = adsbygoogle.requestNonPersonalizedAds || []).push({
              google_ad_channel: '',
              enable_page_level_ads: true
            });
          `
        }}
      />
    </>
  );
}

/**
 * In-Content Ad for article body
 * Inserted between paragraphs
 */
export async function InContentAd({ className = '' }: { className?: string }) {
  return <AdSlot position="in_content" className={className} />;
}

/**
 * Get all active ad positions for a page
 */
export async function getActiveAdPositions(): Promise<string[]> {
  const slots = await getCachedAdSlots();
  return Object.keys(slots);
}

// Export default for backwards compatibility
export default AdSlot;
