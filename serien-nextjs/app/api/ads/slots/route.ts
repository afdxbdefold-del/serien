import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

// Cache ad slots for 5 minutes
const getCachedAdSlots = unstable_cache(
  async () => {
    return prisma.ad_slots.findMany({
      where: { isActive: true },
    });
  },
  ['ad-slots'],
  { revalidate: 300, tags: ['ad-slots'] }
);

// GET active ad slots (public endpoint for frontend)
export async function GET() {
  try {
    const adSlots = await getCachedAdSlots();
    
    // Convert to a map for easy lookup
    const slotsMap: Record<string, any> = {};
    adSlots.forEach(slot => {
      slotsMap[slot.position] = {
        adClient: slot.adClient,
        adSlot: slot.adSlot,
        width: slot.width,
        height: slot.height,
        mobileOnly: slot.mobileOnly,
        desktopOnly: slot.desktopOnly,
      };
    });
    
    return NextResponse.json(slotsMap);
  } catch (error) {
    console.error('Error fetching ad slots:', error);
    return NextResponse.json({}, { status: 200 }); // Return empty on error
  }
}
