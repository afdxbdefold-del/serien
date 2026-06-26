/**
 * Seed-Skript: legt den ad_slots-Eintrag für position="below_breadcrumb" an,
 * falls noch nicht vorhanden. Default-Werte sind so gewählt, dass der Slot
 * sofort rendert (320x100 mobile-banner-artiger Platz unter der Breadcrumb).
 *
 * Wenn die echte AdSense Slot-ID bekannt ist, einfach im Admin-UI /admin/ads
 * editieren — Eintrag bleibt erhalten (upsert).
 */
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';

async function main() {
  const slot = await prisma.ad_slots.upsert({
    where: { position: 'below_breadcrumb' },
    update: {},
    create: {
      id: randomUUID(),
      position: 'below_breadcrumb',
      name: 'Unter Breadcrumb',
      description: 'Slot unterhalb der Breadcrumb, oberhalb des Artikel-Titels',
      provider: 'adsense',
      adClient: 'ca-pub-8583619451045805',
      // Placeholder Slot-ID — durch echte AdSense-Slot-ID im Admin ersetzen.
      adSlot: '0000000000',
      rotationMode: 'random',
      width: 320,
      height: 100,
      isActive: true,
      mobileOnly: false,
      desktopOnly: false,
      updatedAt: new Date(),
    },
  });
  console.log('Slot upserted:', slot);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
