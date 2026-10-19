/** Migration-free accounting for automatic NEWS model calls. No prompts, URLs or
 * credentials are stored. Amounts are estimates in USD, not provider invoices. */
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';
import prisma from './prisma';
import type { NewsLLMRole } from './llm-config';

const context = new AsyncLocalStorage<{ trigger: 'cron' }>();
export const NEWS_MONTHLY_BUDGET_USD = 25; // conservative buffer below the owner's 30 EUR target
export const NEWS_DAILY_ATTEMPT_LIMIT = 3;
export const NEWS_CANDIDATE_RESERVE_USD = 4;
const RATE_PER_MILLION: Record<string, { input: number; cached: number; cacheWrite: number; output: number }> = {
  'gpt-6-astra': { input: 10, cached: 1, cacheWrite: 12.5, output: 50 },
  'gpt-6.1-sol': { input: 2, cached: 0.1, cacheWrite: 2.5, output: 10 },
};

export class NewsCostAccountingError extends Error {
  constructor() { super('News usage accounting unavailable'); this.name = 'NewsCostAccountingError'; }
}

export interface CompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function estimateNewsCostUsd(model: string, usage: CompletionUsage | undefined): number | null {
  const rates = RATE_PER_MILLION[model];
  const input = nonnegativeInteger(usage?.prompt_tokens);
  const output = nonnegativeInteger(usage?.completion_tokens);
  const cached = nonnegativeInteger(usage?.prompt_tokens_details?.cached_tokens) ?? 0;
  const written = nonnegativeInteger(usage?.prompt_tokens_details?.cache_write_tokens) ?? 0;
  if (!rates || input === null || output === null || cached + written > input) return null;
  return ((input - cached - written) * rates.input + cached * rates.cached
    + written * rates.cacheWrite + output * rates.output) / 1_000_000;
}

export function withAutomaticNewsAccounting<T>(work: () => Promise<T>): Promise<T> {
  return context.run({ trigger: 'cron' }, work);
}

export async function recordNewsCompletionUsage(role: NewsLLMRole, model: string, usage: CompletionUsage | undefined,
  db: Pick<PrismaClient, 'pipeline_runs'> = prisma): Promise<void> {
  if (!context.getStore()) return;
  const estimatedUsd = estimateNewsCostUsd(model, usage);
  if (estimatedUsd === null) throw new NewsCostAccountingError();
  try {
    await db.pipeline_runs.create({ data: {
      id: randomUUID(), pipeline: 'news-llm-usage', trigger: 'cron', status: 'success',
      startedAt: new Date(), completedAt: new Date(),
      metadata: JSON.stringify({ role, model, estimatedUsd,
        inputTokens: usage!.prompt_tokens, outputTokens: usage!.completion_tokens,
        cachedTokens: usage!.prompt_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: usage!.prompt_tokens_details?.cache_write_tokens ?? 0 }),
    } });
  } catch { throw new NewsCostAccountingError(); }
}

export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function dayStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Invalid env values fail to the conservative defaults, never to unlimited. */
export function configuredNewsCostLimits(env: Record<string, string | undefined> = process.env, now = new Date()):
  { monthlyUsd: number; dailyAttempts: number; openingSpendUsd: number } {
  const usd = Number(env.NEWS_MONTHLY_BUDGET_USD);
  const attempts = Number(env.NEWS_DAILY_ATTEMPT_LIMIT);
  // October already has API spend from before this ledger exists. Without an
  // explicit project-usage baseline, automation must not reset that spend to 0.
  const initialMeterMonth = '2026-10';
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const baselineText = env.NEWS_COST_BASELINE_USD?.trim();
  const baseline = baselineText ? Number(baselineText) : NaN;
  return {
    monthlyUsd: Number.isFinite(usd) && usd >= NEWS_CANDIDATE_RESERVE_USD && usd <= 100
      ? usd : NEWS_MONTHLY_BUDGET_USD,
    dailyAttempts: Number.isInteger(attempts) && attempts >= 1 && attempts <= 20
      ? attempts : NEWS_DAILY_ATTEMPT_LIMIT,
    openingSpendUsd: month === initialMeterMonth
      ? Number.isFinite(baseline) && baseline >= 0 ? baseline : Infinity
      : 0,
  };
}

/** Fails closed on missing/malformed usage rows; an unknown cost is not zero. */
export async function automaticNewsSpendUsd(db: Pick<PrismaClient, 'pipeline_runs'>, now = new Date()): Promise<number> {
  const rows = await db.pipeline_runs.findMany({
    where: { pipeline: 'news-llm-usage', trigger: 'cron', startedAt: { gte: monthStartUtc(now) } },
    select: { metadata: true },
  });
  let sum = 0;
  for (const row of rows) {
    try {
      const value = JSON.parse(row.metadata || '').estimatedUsd;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error();
      sum += value;
    } catch { throw new NewsCostAccountingError(); }
  }
  return sum;
}

export function mayStartNewsCandidate(spentUsd: number, attemptsToday: number,
  budgetUsd = NEWS_MONTHLY_BUDGET_USD, dailyLimit = NEWS_DAILY_ATTEMPT_LIMIT):
  'monthly-cost-limit' | 'daily-attempt-limit' | null {
  if (attemptsToday >= dailyLimit) return 'daily-attempt-limit';
  if (!Number.isFinite(spentUsd) || spentUsd + NEWS_CANDIDATE_RESERVE_USD > budgetUsd) return 'monthly-cost-limit';
  return null;
}
