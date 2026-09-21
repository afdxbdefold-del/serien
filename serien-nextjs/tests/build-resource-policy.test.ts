import assert from 'node:assert/strict';
import test from 'node:test';
import nextConfig from '../next.config';

// The configuration has no DB/provider imports; do not invoke application
// routes or an actual build from this regression test.
test('production builds use one page worker and one concurrent page', () => {
  assert.equal(nextConfig.experimental?.cpus, 1);
  assert.equal(nextConfig.experimental?.staticGenerationMaxConcurrency, 1);
});

test('Webpack memory optimizations preserve standalone output and its build worker', () => {
  assert.equal(nextConfig.experimental?.webpackMemoryOptimizations, true);
  assert.equal(nextConfig.output, 'standalone');
  assert.notEqual(nextConfig.experimental?.webpackBuildWorker, false);
  assert.equal(nextConfig.webpack, undefined, 'custom Webpack config would disable the default build worker');
  assert.notEqual(nextConfig.experimental?.parallelServerCompiles, true);
  assert.notEqual(nextConfig.experimental?.parallelServerBuildTraces, true);
});
