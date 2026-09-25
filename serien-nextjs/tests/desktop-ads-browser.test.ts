import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type BrowserContextOptions } from 'playwright';

// Isolated component harness: no Next app, .env, production, database or live ad calls.
// Every page request is fulfilled locally; DNS is disabled as a second barrier,
// including for provider preconnects which are not regular Playwright requests.
const appDirectory = fileURLToPath(new URL('../', import.meta.url));
const executablePath = [
  chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(path => existsSync(path));
const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const adSelector = '[data-tmn-slot], [data-ad-position], [data-ad-slot-wrapper], [data-global-tag], [data-fixture-global-ad]';

async function main() {
  assert.ok(executablePath, 'An installed Chromium/Chrome/Edge browser is required; tests never download a browser');
  const bundle = await build({
    absWorkingDir: appDirectory, entryPoints: ['tests/fixtures/desktop-ads-fixture.tsx'],
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{
      name: 'isolated-navigation',
      setup(plugin) {
        plugin.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents: 'export function usePathname() { return "/fixture"; }', loader: 'js',
        }));
      },
    }],
  });
  const browser = await chromium.launch({
    executablePath, headless: true,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run',
      '--disable-default-apps', '--host-resolver-rules=MAP * ~NOTFOUND'],
  });
  const fixtureHtml = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<div id="fixture-root"></div><script src="/fixture.js"></script></body></html>';
  const slot = {
    provider: 'custom', width: 970, height: 250, device: 'desktop', desktopOnly: true, mobileOnly: false,
    customHtmlVariants: [{ html: '<span data-slot-creative>Desktop ad</span><script src="https://ads.invalid/slot.js"></script>' }],
  };
  const cases: Array<{ name: string; width: number; allowed: boolean; context?: BrowserContextOptions; override?: string }> = [
    { name: 'desktop at breakpoint', width: 1024, allowed: true },
    { name: 'desktop wide', width: 1440, allowed: true },
    { name: 'narrow desktop', width: 1023, allowed: false },
    { name: 'phone', width: 390, allowed: false, context: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile', isMobile: true, hasTouch: true,
    } },
    { name: 'Android tablet', width: 1280, allowed: false, context: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X910) Chrome/140.0.0.0 Safari/537.36',
    } },
    { name: 'large iPad with mouse', width: 1366, allowed: false, context: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    }, override: "Object.defineProperty(navigator, 'platform', {value:'MacIntel'}); Object.defineProperty(navigator, 'maxTouchPoints', {value:5});" },
    { name: 'client-hints mobile', width: 1440, allowed: false,
      override: "Object.defineProperty(navigator, 'userAgentData', {value:{mobile:true}});" },
    { name: 'media API missing', width: 1440, allowed: false, override: 'window.matchMedia = undefined;' },
    { name: 'media API throws', width: 1440, allowed: false,
      override: 'window.matchMedia = function () { throw new Error("unsupported"); };' },
  ];
  try {
    for (const testCase of cases) {
      const context = await browser.newContext({
        userAgent: desktopUserAgent, viewport: { width: testCase.width, height: 900 },
        serviceWorkers: 'block', ...testCase.context,
      });
      const requests: string[] = [];
      const errors: string[] = [];
      let slotFetches = 0;
      if (testCase.override) await context.addInitScript(testCase.override);
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fixture.invalid' && url.pathname === '/') {
          await route.fulfill({ contentType: 'text/html', body: fixtureHtml });
        } else if (url.hostname === 'fixture.invalid' && url.pathname === '/fixture.js') {
          await route.fulfill({ contentType: 'application/javascript', body: bundle.outputFiles[0].text });
        } else if (url.hostname === 'fixture.invalid' && url.pathname === '/api/ads/slots') {
          slotFetches += 1;
          await route.fulfill({ json: { desktop: { article_bottom: slot, news_infeed: slot }, mobile: {} } });
        } else {
          // Nothing is ever continued to a real network provider.
          requests.push(route.request().url());
          if (route.request().resourceType() === 'script') {
            await route.fulfill({ contentType: 'application/javascript', body: '/* harmless local provider stub */' });
          } else if (route.request().resourceType() === 'stylesheet') {
            await route.fulfill({ contentType: 'text/css', body: '/* harmless local stylesheet */' });
          } else if (route.request().resourceType() === 'image') {
            await route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
          } else {
            await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local fixture</title>' });
          }
        }
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('https://fixture.invalid/');
      await page.waitForFunction(() => document.documentElement.dataset.fixtureMounted === 'true');
      await page.waitForLoadState('networkidle');
      assert.deepEqual(errors, [], `${testCase.name}: no runtime errors`);
      assert.equal(await page.locator('html').getAttribute('data-ads-ssr'), '', `${testCase.name}: server rendering emits no provider, global tag, ad or preload markup`);
      assert.equal(await page.locator('#editorial-content').count(), 1, `${testCase.name}: content retained`);
      if (testCase.allowed) {
        assert.ok(await page.locator(adSelector).count() > 0, `${testCase.name}: desktop slots mounted`);
        assert.equal(slotFetches, 1, `${testCase.name}: shared slot request deduplicated`);
        for (const needle of ['ads.themoneytizer.com', 'cmp.inmobi.com', 'ezojs.com', 'ezoicanalytics.com',
          'a.pub.network/serien-de/pubfig.min.js', 'live.primis.tech', 'ads.invalid/global.js', 'ads.invalid/slot.js']) {
          assert.ok(requests.some(url => url.includes(needle)), `${testCase.name}: ${needle} retained for desktop`);
        }
        if (testCase.width === 1440) {
          const requestsBeforeResize = requests.length;
          await page.setViewportSize({ width: 390, height: 900 });
          await page.waitForFunction(selector => !document.querySelector(selector), adSelector);
          await page.waitForLoadState('networkidle');
          assert.equal(requests.length, requestsBeforeResize, 'resize down adds no new provider requests in controlled fixture');
          assert.equal(await page.locator('link[rel="preconnect"]').count(), 0, 'resize removes ad preconnects');
          const providerScriptsBefore = requests.filter(url => /pubfig\.min\.js|sa\.min\.js|liveView\.php|choice\.js/.test(url)).length;
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.waitForFunction(selector => !!document.querySelector(selector), adSelector);
          await page.waitForLoadState('networkidle');
          assert.equal(requests.filter(url => /pubfig\.min\.js|sa\.min\.js|liveView\.php|choice\.js/.test(url)).length,
            providerScriptsBefore, 'resize up does not bootstrap existing global SDKs twice');
        }
      } else {
        assert.equal(await page.locator(adSelector).count(), 0, `${testCase.name}: no hidden ad wrappers or creative DOM`);
        assert.equal(slotFetches, 0, `${testCase.name}: no slot API request`);
        assert.deepEqual(requests, [], `${testCase.name}: no advertising, CMP, creative, iframe or stylesheet requests`);
        assert.equal(await page.locator('link[rel="preconnect"],script[src*="ads."],iframe').count(), 0,
          `${testCase.name}: no provider preconnects, scripts or frames`);
      }
      console.log(`desktop-ads-browser: ${testCase.name} passed (${requests.length} locally stubbed provider requests)`);
      await context.close();
    }
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
