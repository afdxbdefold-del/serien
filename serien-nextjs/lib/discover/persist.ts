/**
 * Discover Audit Persistence
 * 
 * Saves Discover Gate evaluation results to database
 */

import prisma from '@/lib/prisma';
import { DiscoverBreakdown } from './types';

export async function saveDiscoverAudit(articleId: string, breakdown: DiscoverBreakdown) {
  const getSignal = (k: string) => breakdown.signals.find(s => s.key === k);
  const depth = getSignal("CONTENT_DEPTH")?.evidence?.wordCount ?? 0;

  return prisma.discoverAudit.upsert({
    where: { articleId },
    create: {
      articleId,
      discoverScore: Math.round(breakdown.totalScore),
      discoverMode: breakdown.passed ? "DISCOVER" : "SEARCH_ONLY",
      passed: breakdown.passed,
      breakdownJson: breakdown as any,
      wordCount: Number(depth) || 0,
      hasHero: Boolean(getSignal("IMAGE_QUALITY")?.evidence?.hasHero),
      hasByline: Boolean(getSignal("E_E_A_T")?.evidence?.hasByline),
      freshnessHours: Number(getSignal("FRESHNESS")?.evidence?.freshnessHours) || 999,
      aiRiskScore: Math.round(Number(getSignal("AI_RISK")?.score) || 0),
    },
    update: {
      discoverScore: Math.round(breakdown.totalScore),
      discoverMode: breakdown.passed ? "DISCOVER" : "SEARCH_ONLY",
      passed: breakdown.passed,
      breakdownJson: breakdown as any,
      wordCount: Number(depth) || 0,
      hasHero: Boolean(getSignal("IMAGE_QUALITY")?.evidence?.hasHero),
      hasByline: Boolean(getSignal("E_E_A_T")?.evidence?.hasByline),
      freshnessHours: Number(getSignal("FRESHNESS")?.evidence?.freshnessHours) || 999,
      aiRiskScore: Math.round(Number(getSignal("AI_RISK")?.score) || 0),
      updatedAt: new Date(),
    },
  });
}
