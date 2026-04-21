/**
 * Simple key/value settings store, backed by the `app_settings` DB table.
 * Used for runtime feature flags (e.g. pipeline kill-switch).
 *
 * Values are stored as strings. Booleans serialize as "true" / "false".
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.app_settings.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, updatedBy?: string): Promise<void> {
  await prisma.app_settings.upsert({
    where: { key },
    update: { value, updatedBy: updatedBy ?? null },
    create: { key, value, updatedBy: updatedBy ?? null },
  });
}

export async function getBoolSetting(key: string, defaultValue = false): Promise<boolean> {
  const v = await getSetting(key);
  if (v === null) return defaultValue;
  return v === 'true' || v === '1';
}

/** Key constants */
export const SETTINGS = {
  PIPELINE_CRON_PAUSED: 'pipeline.cron.paused',
} as const;
