/**
 * Seed: `above_recommended` Slot (728×250 Leaderboard direkt vor dem
 * TMN-Recommended-Content-Widget, global via LayoutWrapper).
 * Klont die aktive `desktop_megabanner_bottom`-Config damit derselbe
 * High-Fill-Ad-Code sofort läuft.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const p = new PrismaClient();

async function main() {
  const src = await p.ad_slots.findUnique({
    where: { position_device: { position: 'desktop_megabanner_bottom', device: 'desktop' } },
  });
  if (!src) {
    console.error('Source slot desktop_megabanner_bottom (desktop) not found — abort.');
    process.exit(1);
  }

  const existing = await p.ad_slots.findUnique({
    where: { position_device: { position: 'above_recommended', device: 'desktop' } },
  });

  const data = {
    position: 'above_recommended',
    device: 'desktop',
    name: 'Global · Above Recommended-Content',
    description: '728×250 Leaderboard direkt vor dem TMN-Recommended-Content-Widget. Läuft global auf allen Public-Seiten (außer Legal).',
    provider: src.provider,
    adClient: src.adClient,
    adSlot: src.adSlot,
    customHtmlJson: src.customHtmlJson,
    rotationMode: src.rotationMode,
    width: 728,
    height: 250,
    isActive: true,
    mobileOnly: false,
    desktopOnly: true,
    updatedAt: new Date(),
  };

  if (existing) {
    await p.ad_slots.update({ where: { id: existing.id }, data });
    console.log(`↻ above_recommended aktualisiert (isActive=${data.isActive})`);
  } else {
    await p.ad_slots.create({ data: { id: randomUUID(), ...data } });
    console.log(`+ above_recommended angelegt (Clone von desktop_megabanner_bottom) → aktiv`);
  }
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
