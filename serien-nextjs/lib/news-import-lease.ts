import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const LEASE_KEY = 'pipeline.news.import.lease';
// Renewed during work; a killed container relinquishes its stale lease after
// 30 minutes. No transaction/DB connection is held while calling providers.
const STALE_AFTER_MS = 30 * 60_000;
const HEARTBEAT_MS = 30_000;

export async function acquireNewsImportLease(prisma: PrismaClient): Promise<{
  assertHeld: () => Promise<void>;
  release: () => Promise<void>;
} | null> {
  const owner = randomUUID();
  // One atomic statement (not find-then-create) protects across containers.
  const acquired = await prisma.$executeRaw`
    INSERT INTO app_settings (key, value, "updatedAt", "updatedBy")
    VALUES (${LEASE_KEY}, ${owner}, NOW(), 'news-import')
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, "updatedAt" = NOW(), "updatedBy" = 'news-import'
      WHERE app_settings."updatedAt" < NOW() - (${STALE_AFTER_MS} * INTERVAL '1 millisecond')
  `;
  if (acquired !== 1) return null;
  let lost = false;
  let pending: Promise<void> | null = null;
  const renew = (): Promise<void> => {
    if (pending) return pending;
    pending = (async () => {
      const result = await prisma.$executeRaw`
        UPDATE app_settings SET "updatedAt" = NOW()
        WHERE key = ${LEASE_KEY} AND value = ${owner}
      `;
      if (result !== 1) throw new Error('News import lease lost');
    })().catch((error) => {
      lost = true;
      throw error;
    }).finally(() => { pending = null; });
    return pending;
  };
  const heartbeat = setInterval(() => { void renew().catch(() => {}); }, HEARTBEAT_MS);
  heartbeat.unref?.();
  return {
    async assertHeld() {
      if (lost) throw new Error('News import lease lost');
      await renew();
    },
    async release() {
      clearInterval(heartbeat);
      if (pending) await pending.catch(() => {});
      // Never remove a replacement worker's lease.
      await prisma.$executeRaw`DELETE FROM app_settings WHERE key = ${LEASE_KEY} AND value = ${owner}`;
    },
  };
}
