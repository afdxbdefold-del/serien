import { isIP } from 'node:net';

export interface ValidPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const DEFAULT_EXACT_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
]);
const DEFAULT_HOST_SUFFIXES = ['.notify.windows.com'];
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function configuredHostPatterns(): string[] {
  return (process.env.PUSH_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function matchesConfiguredHost(hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  return hostname === pattern;
}

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length < 16 || endpoint.length > 2048) {
    return false;
  }

  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      isIP(url.hostname)
    ) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return DEFAULT_EXACT_HOSTS.has(hostname)
      || DEFAULT_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
      || configuredHostPatterns().some((pattern) => matchesConfiguredHost(hostname, pattern));
  } catch {
    return false;
  }
}

function isValidKey(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string'
    && value.length >= min
    && value.length <= max
    && BASE64URL.test(value);
}

export function parsePushSubscription(input: unknown): ValidPushSubscription | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };

  if (
    !isAllowedPushEndpoint(candidate.endpoint)
    || !isValidKey(candidate.keys?.p256dh, 40, 200)
    || !isValidKey(candidate.keys?.auth, 8, 100)
  ) {
    return null;
  }

  return {
    endpoint: new URL(candidate.endpoint).toString(),
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth,
    },
  };
}
