import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Neon-optimierter Prisma-Client (Feb 2026, Cost-Sprint).
 *
 * Ziel: Compute-Hours runter, idle Connections killen sodass Neon
 * autosuspend nach 5 min greift.
 *
 * ENV-Setup (Neon Dashboard → Connection Details):
 *   DATABASE_URL   = pgbouncer/pooler-URL (`...-pooler.neon.tech/...`),
 *                    Suffix `?pgbouncer=true&connection_limit=1&pool_timeout=10&connect_timeout=10`
 *   DIRECT_URL     = direct URL (`...neon.tech/...`), NUR für `prisma migrate`
 *
 * Warum `connection_limit=1`:
 *  - Neon-Pooler multiplext bereits alle Requests auf wenige Backend-Slots.
 *  - Jede Serverless-Function-Invocation soll genau EINE Client-Connection
 *    aufmachen und danach loslassen.
 *  - Verhindert Idle-Connections die Neon wach halten.
 */
const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;
