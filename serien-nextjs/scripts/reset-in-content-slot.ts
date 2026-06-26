/**
 * Stellt den in_content-Slot auf den simpelsten WP-Theme-artigen Setup um:
 * - provider=adsense (kein Custom-HTML mehr)
 * - adSlot=8135604915 (neue In-Article-Slot-ID des Publishers)
 * - width/height nur als Hint (in-article ist fluid)
 * Lässt customHtmlJson liegen, falls jemand zurückwill — der Provider-Wert
 * entscheidet, was gerendert wird.
 */
import prisma from '@/lib/prisma';

async function main() {
  const updated = await prisma.ad_slots.update({
    where: { position: 'in_content' },
    data: {
      provider: 'adsense',
      adClient: 'ca-pub-8583619451045805',
      adSlot: '8135604915',
      width: 300,
      height: 250,
      isActive: true,
      updatedAt: new Date(),
    },
  });
  console.log('in_content slot updated:', {
    provider: updated.provider,
    adSlot: updated.adSlot,
    adClient: updated.adClient,
  });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
