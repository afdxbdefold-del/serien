/**
 * IVT / Fake-Human Detection für /x-news.
 *
 * - block_key:  Nicht-rotierender SHA256(IP+UA), 16 hex. Wird NUR intern
 *               für die Block-Lookup-Tabelle verwendet, nie im Public-Stats-
 *               Response gezeigt. Rotation-frei, damit ein Bot, der heute
 *               geblockt wird, morgen auch noch geblockt bleibt — selbst
 *               wenn die täglich rotierende visitorId neu ist.
 * - Stufe A (Hard-Block):  UA-Mustererkennung (Googlebot, curl, wget,
 *               headless, scraper-Libs etc.). Blockt SOFORT bei erstem
 *               Aufruf, ohne den Klick je zu loggen. TTL 7 Tage.
 * - Stufe B (Behavior-Block):  Asynchroner Analyzer scannt die letzten
 *               24h analytics_events nach 4 Signalen pro block_key:
 *                 (1) > 5 Klicks in 24h
 *                 (2) Klick-Intervall < 3 s
 *                 (3) Zero-Engagement (nur x_news_click, keine Folge-PVs)
 *                 (4) Geo-Anomalie (Land nicht in DACH-Whitelist)
 *               Trifft ≥ 2 Signale → Block für 30 Tage.
 *
 * Privacy: IP wird nie roh in DB gespeichert, nur als Teil des Hashs.
 */
import { createHash } from 'crypto';
import { detectBot } from './crawler-logger';

const DACH_COUNTRIES = new Set(['DE', 'AT', 'CH', 'LU', 'BE', 'LI']);

const GENERIC_BOT_HINTS = [
  'bot', 'crawler', 'spider', 'scrap', 'curl/', 'wget/', 'python-requests',
  'http-client', 'go-http-client', 'okhttp/', 'java/', 'libwww-perl',
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'lighthouse',
  'pagespeed', 'gtmetrix', 'monitor', 'uptimerobot', 'pingdom', 'newrelic',
  'datadog', 'archive.org', 'wayback',
];

export function computeBlockKey(ip: string, ua: string): string {
  return createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);
}

export interface HardBlockResult {
  blocked: boolean;
  label?: string;
}

export function checkHardBlock(ua: string | null): HardBlockResult {
  if (!ua) return { blocked: true, label: 'no-user-agent' };
  const named = detectBot(ua);
  if (named) return { blocked: true, label: named };
  const low = ua.toLowerCase();
  for (const hint of GENERIC_BOT_HINTS) {
    if (low.includes(hint)) return { blocked: true, label: `generic:${hint}` };
  }
  return { blocked: false };
}

export interface BehaviorAnalysisInput {
  clicks: Array<{ createdAt: Date; country?: string | null }>;
  followUpPageViewsCount: number;
  primaryCountry?: string | null;
}

export interface BehaviorSignals {
  highRate: boolean;        // > 5 clicks in 24h
  rapidInterval: boolean;   // < 3 s between two clicks
  zeroEngagement: boolean;  // no follow-up pageviews
  geoAnomaly: boolean;      // country not in DACH whitelist
  score: number;            // sum of triggered signals
  details: {
    clickCount: number;
    minIntervalSec: number | null;
    country?: string | null;
  };
}

export function analyzeBehavior(input: BehaviorAnalysisInput): BehaviorSignals {
  const clicks = input.clicks.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let minIntervalSec: number | null = null;
  for (let i = 1; i < clicks.length; i++) {
    const diff = (clicks[i].createdAt.getTime() - clicks[i - 1].createdAt.getTime()) / 1000;
    if (minIntervalSec === null || diff < minIntervalSec) minIntervalSec = diff;
  }

  const highRate = clicks.length > 5;
  const rapidInterval = minIntervalSec !== null && minIntervalSec < 3;
  const zeroEngagement = clicks.length >= 2 && input.followUpPageViewsCount === 0;
  const country = input.primaryCountry || null;
  const geoAnomaly = country != null && !DACH_COUNTRIES.has(country);

  const score = [highRate, rapidInterval, zeroEngagement, geoAnomaly].filter(Boolean).length;

  return {
    highRate,
    rapidInterval,
    zeroEngagement,
    geoAnomaly,
    score,
    details: { clickCount: clicks.length, minIntervalSec, country },
  };
}
