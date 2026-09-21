import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import nextConfig from '../next.config';

// The configuration has no DB/provider imports; do not invoke application
// routes or an actual build from this regression test.
test('production builds use one page worker and one concurrent page', () => {
  assert.equal(nextConfig.experimental?.cpus, 1);
  assert.equal(nextConfig.experimental?.staticGenerationMaxConcurrency, 1);
});

test('the Docker build heap is bounded without changing runtime Node options', () => {
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const builder = dockerfile.split(' AS builder')[1].split(' AS runner')[0];
  const runner = dockerfile.split(' AS runner')[1];
  assert.match(builder, /ENV NODE_OPTIONS="--max-old-space-size=1024"/);
  assert.doesNotMatch(runner, /ENV NODE_OPTIONS=/);
});

test('Webpack memory optimizations preserve standalone output and its build worker', () => {
  assert.equal(nextConfig.experimental?.webpackMemoryOptimizations, true);
  assert.equal(nextConfig.output, 'standalone');
  assert.notEqual(nextConfig.experimental?.webpackBuildWorker, false);
  assert.equal(nextConfig.webpack, undefined, 'custom Webpack config would disable the default build worker');
  assert.notEqual(nextConfig.experimental?.parallelServerCompiles, true);
  assert.notEqual(nextConfig.experimental?.parallelServerBuildTraces, true);
});
