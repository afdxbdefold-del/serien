import assert from 'node:assert/strict';
import { searchTvEnhanced } from '../lib/tmdb-search-enhanced';

const originalFetch = globalThis.fetch;
const originalKey = process.env.TMDB_API_KEY;

async function run(): Promise<void> {
  try {
    process.env.TMDB_API_KEY = 'test-only-key';
    let calls = 0;
    globalThis.fetch = (async (_url, init) => {
      calls += 1;
      assert(init?.signal instanceof AbortSignal, 'TMDB requests need a timeout signal');
      throw new Error('TMDB unavailable');
    }) as typeof fetch;

    assert.equal(await searchTvEnhanced('Nordhafen', 'Nordhafen bekommt eine neue Staffel.'), null);
    assert.equal(calls, 1, 'a failed exact lookup must not fan out to more TMDB requests');

    globalThis.fetch = (async (_url, init) => {
      calls += 1;
      assert(init?.signal instanceof AbortSignal);
      return { ok: false, status: 503 } as Response;
    }) as typeof fetch;

    assert.equal(await searchTvEnhanced('Nordhafen', 'Nordhafen bekommt eine neue Staffel.'), null);
    assert.equal(calls, 2, 'an unsuccessful exact lookup must fail fast');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }

  console.log('PASS bounded TMDB lookup falls back safely after network failure');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
