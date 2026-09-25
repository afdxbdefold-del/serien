import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import policy from '../public/desktop-ads-policy';
import { canLoadDesktopAds, subscribeDesktopAds } from '../lib/desktop-ads';
import { injectHtmlWithScripts } from '../lib/ad-html-injector';
import { fetchAdSlots, isMobileViewport, pickSlotForViewport, type AdConfig } from '../lib/ad-slots-client';
import DesktopOnlyAds from '../components/DesktopOnlyAds';

// No app startup, database, .env loading or real network requests in this suite.
const desktopNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
};
const desktopWindow = (width = 1440, hover = true, finePointer = true) => ({
  matchMedia(query: string) {
    assert.equal(query, '(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    return { matches: width >= 1024 && hover && finePointer };
  },
});

const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
function setGlobal(name: string, value: unknown) {
  if (!originalGlobals.has(name)) originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
function restoreGlobals() {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
function setDevice(width: number, nav = desktopNavigator, hover = true, finePointer = true) {
  setGlobal('window', desktopWindow(width, hover, finePointer));
  setGlobal('navigator', nav);
}

async function main() {
  for (const width of [1024, 1440, 2560]) {
    assert.equal(policy.canLoadDesktopAds(desktopWindow(width), desktopNavigator), true, `desktop ${width}px`);
  }
  for (const width of [390, 767, 768, 1023]) {
    assert.equal(policy.canLoadDesktopAds(desktopWindow(width), desktopNavigator), false, `narrow desktop ${width}px`);
  }
  assert.equal(policy.canLoadDesktopAds(desktopWindow(1440, false), desktopNavigator), false, 'hover required');
  assert.equal(policy.canLoadDesktopAds(desktopWindow(1440, true, false), desktopNavigator), false, 'fine primary pointer required');
  for (const userAgent of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile',
    'Mozilla/5.0 (Linux; Android 14; SM-X910) Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; U; en-US) Silk/3.2 Safari/533.1',
    'Mozilla/5.0 (Tablet; rv:40.0) Gecko/40.0 Firefox/40.0',
    'Mozilla/5.0 (PlayBook; U; RIM Tablet OS 2.1.0) AppleWebKit/536.2+',
  ]) {
    assert.equal(policy.canLoadDesktopAds(desktopWindow(1920), { ...desktopNavigator, userAgent }), false, userAgent);
  }
  assert.equal(policy.canLoadDesktopAds(desktopWindow(1366), {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    platform: 'MacIntel', maxTouchPoints: 5,
  }), false, 'large iPad with mouse and desktop-mode user agent remains blocked');
  assert.equal(policy.canLoadDesktopAds(desktopWindow(), {
    ...desktopNavigator, userAgentData: { mobile: true },
  }), false, 'client hints can veto a desktop-looking user agent');
  assert.equal(policy.canLoadDesktopAds(desktopWindow(), {
    ...desktopNavigator, platform: 'MacIntel', maxTouchPoints: 0,
  }), true, 'ordinary Mac desktop is allowed');

  for (const [win, nav] of [
    [undefined, desktopNavigator], [null, desktopNavigator], [{}, desktopNavigator],
    [desktopWindow(), undefined],
    [{ matchMedia() { throw new Error('unavailable'); } }, desktopNavigator],
    [{ matchMedia() { return undefined; } }, desktopNavigator],
  ] as const) assert.equal(policy.canLoadDesktopAds(win, nav), false, 'unknown capability fails closed');

  // The public script used by standalone HTML pages must implement the same policy.
  const publicSource = readFileSync(new URL('../public/desktop-ads-policy.js', import.meta.url), 'utf8');
  for (const width of [390, 1024, 1440]) {
    const win = { ...desktopWindow(width), navigator: desktopNavigator };
    runInNewContext(publicSource, { window: win });
    assert.equal((win as any).__serienDesktopAdsAllowed(), width >= 1024, 'standalone browser export');
  }

  setGlobal('window', undefined);
  setGlobal('navigator', undefined);
  assert.equal(canLoadDesktopAds(), false, 'SSR must not infer desktop');
  assert.doesNotThrow(() => subscribeDesktopAds(() => {})(), 'SSR subscription is inert');
  assert.equal(renderToString(createElement(DesktopOnlyAds, null,
    createElement('iframe', { src: 'https://ads.invalid/should-never-appear' }))), '', 'SSR emits no ad markup or preloads');
  let renderedChildren = 0;
  function SideEffectChild() { renderedChildren += 1; return createElement('span', null, 'ad'); }
  setDevice(1440);
  assert.equal(renderToString(createElement(DesktopOnlyAds, null, createElement(SideEffectChild))), '');
  assert.equal(renderedChildren, 0, 'server snapshot blocks even when test globals happen to look like desktop');

  for (const win of [{}, { matchMedia() { throw new Error('unavailable'); } }]) {
    setGlobal('window', win);
    assert.doesNotThrow(() => subscribeDesktopAds(() => {})(), 'unsupported media APIs must not crash hydration');
  }

  const forbiddenDom = new Proxy({}, {
    get() { throw new Error('blocked device touched DOM'); },
    set() { throw new Error('blocked device changed DOM'); },
  });
  setDevice(390);
  setGlobal('document', forbiddenDom);
  assert.doesNotThrow(() => injectHtmlWithScripts(forbiddenDom as HTMLElement,
    '<img src="https://ads.invalid/pixel"><iframe src="https://ads.invalid/frame"></iframe><script src="https://ads.invalid/script"></script>'),
  'guard must run before parsing HTML, clearing containers or requesting creative assets');

  let fetches = 0;
  setGlobal('fetch', () => { fetches += 1; throw new Error('unexpected real fetch'); });
  assert.deepEqual(await fetchAdSlots(), { mobile: {}, desktop: {} });
  assert.equal(fetches, 0, 'mobile must not fetch /api/ads/slots');
  assert.equal(isMobileViewport(), true);

  const desktopSlot: AdConfig = {
    provider: 'custom', customHtmlVariants: [{ html: '<b>desktop</b>' }], width: 970,
    height: 250, device: 'desktop', desktopOnly: true, mobileOnly: false,
  };
  const mobileSlot: AdConfig = { ...desktopSlot, device: 'mobile', desktopOnly: false, mobileOnly: true };
  const slots = { desktop: { header: desktopSlot }, mobile: { header: mobileSlot } };
  assert.equal(pickSlotForViewport(slots, 'header', false), null, 'caller cannot override device policy');
  setDevice(1440);
  assert.equal(pickSlotForViewport(slots, 'header', false), desktopSlot);
  assert.equal(pickSlotForViewport(slots, 'header', true), null, 'legacy mobile argument never selects a mobile slot');
  assert.equal(pickSlotForViewport({ desktop: {}, mobile: { header: mobileSlot } }, 'header', false), null, 'no mobile fallback');
  assert.equal(pickSlotForViewport({ desktop: { header: mobileSlot }, mobile: {} }, 'header', false), null, 'mislabeled mobile config rejected');
  assert.equal(pickSlotForViewport({ desktop: { header: { ...desktopSlot, mobileOnly: true } }, mobile: {} }, 'header', false), null);

  let resolveResponse!: (value: unknown) => void;
  setGlobal('fetch', (url: string) => {
    assert.equal(url, '/api/ads/slots'); fetches += 1;
    return new Promise(resolve => { resolveResponse = resolve; });
  });
  const pending = fetchAdSlots();
  assert.equal(fetchAdSlots(), pending, 'desktop fetch is deduplicated');
  assert.equal(fetches, 1);
  setDevice(390);
  resolveResponse({ ok: true, json: async () => slots });
  assert.deepEqual(await pending, { mobile: {}, desktop: {} }, 'response arriving after resize must not activate ads');
  setDevice(1440);
  setGlobal('fetch', async () => { fetches += 1; return { ok: true, json: async () => slots }; });
  assert.deepEqual(await fetchAdSlots(), slots, 'eligible desktop can retry after discarded mobile response');
  assert.equal(fetches, 2);
  assert.deepEqual(await fetchAdSlots(), slots, 'desktop cache is retained');
  assert.equal(fetches, 2);
  setDevice(390);
  assert.deepEqual(await fetchAdSlots(), { mobile: {}, desktop: {} }, 'cached desktop response never bypasses mobile guard');
  assert.equal(fetches, 2);
  console.log('desktop-ads-policy: device matrix, standalone parity, SSR, DOM guard, slot fetch/cache/race regressions passed');
}

main().finally(restoreGlobals).catch(error => { console.error(error); process.exitCode = 1; });
