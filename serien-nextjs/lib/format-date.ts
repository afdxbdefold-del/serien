/**
 * TIMEZONE-SAFE DATE FORMATTING
 *
 * The Vercel serverless runtime is UTC. Raw toLocaleString('de-DE', ...) on
 * the server therefore renders UTC values, which caused "updated at 22:30"
 * to appear on articles that were actually written at 00:30 Berlin time.
 *
 * Always use these helpers for German-locale rendering, both server- and
 * client-side. They force timeZone: 'Europe/Berlin' so SSR and CSR match.
 */
const BERLIN_TZ = 'Europe/Berlin';

export function formatDateDE(
  input: Date | string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  if (input === null || input === undefined) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { timeZone: BERLIN_TZ, ...opts });
}

export function formatTimeDE(
  input: Date | string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  if (input === null || input === undefined) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { timeZone: BERLIN_TZ, ...opts });
}

export function formatDateTimeDE(
  input: Date | string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' },
): string {
  if (input === null || input === undefined) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { timeZone: BERLIN_TZ, ...opts });
}
