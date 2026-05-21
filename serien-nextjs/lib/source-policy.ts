/**
 * Source policy — host-level reputation overrides.
 *
 * The Discover-Gate's source-reputation greylist is a self-tuning feedback
 * loop: hosts that hallucinate ≥3 times in 7 days get a −10 penalty on
 * `trust_clarity`. That's the right default for unknown / boulevard sources.
 *
 * But premium trade outlets (Variety, Deadline, THR …) occasionally publish
 * the same story shape that triggers our verifier — without those outlets
 * actually being unreliable. We don't want a transient hallucination cluster
 * to suppress months of high-quality input from them.
 *
 * WHITELIST: hosts that NEVER receive a greylist penalty, no matter how
 * many entries land in `hallucination_log`. Use sparingly — only outlets
 * with editorial accountability and a track record of accurate German /
 * DACH availability reporting.
 */

const WHITELISTED_HOSTS: ReadonlySet<string> = new Set([
  // US trade outlets — strong editorial standards
  'variety.com',
  'www.variety.com',
  'deadline.com',
  'www.deadline.com',
  'hollywoodreporter.com',
  'www.hollywoodreporter.com',
  // Tech / streaming-business reporting
  'techcrunch.com',
  'theverge.com',
  'www.theverge.com',
  // German-language tier-one
  'dwdl.de',
  'www.dwdl.de',
  'serienjunkies.de',
  'www.serienjunkies.de',
]);

/**
 * @param host  hostname from `new URL(sourceUrl).host` (already lowercased
 *              by the browser/URL parser; we lowercase defensively).
 * @returns true if the host is whitelisted and should NOT be greylisted
 *          regardless of the hallucination count.
 */
export function isSourceHostWhitelisted(host: string | null | undefined): boolean {
  if (!host) return false;
  return WHITELISTED_HOSTS.has(host.toLowerCase());
}
