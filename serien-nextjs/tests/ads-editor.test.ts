import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { composeAdsTxt, nextAdsDocument, parsePastedLines, sellerKey, EMPTY_ADS_DOCUMENT } from '../lib/ads-editor-store';
import { ADS_EDITOR_COOKIE, adsEditorConfigured, createAdsEditorSession, hasAdsEditorSession, matchesAdsEditorPassword, sameOrigin } from '../lib/ads-editor-auth';

test('paste accepts ads.txt seller entries and directives, removing exact duplicates', () => {
  const lines = parsePastedLines('Example.com, Account-1, DIRECT, abc123\r\nexample.com,Account-1,direct,abc123\nINVENTORYPARTNERDOMAIN=pubx.ai\n');
  assert.deepEqual(lines, ['Example.com, Account-1, DIRECT, abc123', 'INVENTORYPARTNERDOMAIN=pubx.ai']);
  assert.equal(sellerKey('EXAMPLE.com,Account-1,direct,ABC123'), sellerKey(lines[0]));
});

test('malformed lines cannot be published', () => {
  for (const sample of ['<script>alert(1)</script>', 'site.com, id, OWNER', 'site.com, id, DIRECT, cert, extra', 'OWNERDOMAIN=https://example.com']) {
    assert.throws(() => parsePastedLines(sample), /Zeile 1/);
  }
  assert.throws(() => parsePastedLines(' '.repeat(50_001)), /50 KB/);
});

test('committed base is byte-preserved, managed duplicates are omitted', () => {
  const base = 'OWNERDOMAIN=serien.de\ngoogle.com, pub-1, DIRECT\n';
  assert.equal(composeAdsTxt(base, []), base);
  assert.equal(composeAdsTxt(base, ['google.com,pub-1,DIRECT', 'new.example, account, RESELLER']),
    `${base}new.example, account, RESELLER\n`);
});

test('rollback creates a new revision and keeps prior history', () => {
  const first = nextAdsDocument(EMPTY_ADS_DOCUMENT, 'append', 'one.example, 1, DIRECT');
  const second = nextAdsDocument(first, 'append', 'two.example, 2, RESELLER');
  assert.equal(second.lines.length, 2);
  const restored = nextAdsDocument(second, 'rollback', first.version);
  assert.deepEqual(restored.lines, first.lines);
  assert.equal(restored.history.length, 3);
  assert.equal(restored.history[0].restoredFrom, first.version);
  const base = nextAdsDocument(restored, 'rollback', 'base');
  assert.deepEqual(base.lines, []);
  assert.equal(base.history.length, 4);
});

test('editor session is scoped and cross-origin writes are rejected', async () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-signing-key-with-at-least-32-characters';
  try {
    const token = await createAdsEditorSession();
    const good = new NextRequest('https://serien.de/api/ads-editor', {
      headers: { host: 'serien.de', origin: 'https://serien.de', cookie: `${ADS_EDITOR_COOKIE}=${token}` },
    });
    assert.equal(good.cookies.get(ADS_EDITOR_COOKIE)?.value, token);
    const verified = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), {
      algorithms: ['HS256'], issuer: 'serien.de/ads-editor', audience: 'ads-editor',
    });
    assert.equal(verified.payload.sub, 'ads-editor');
    assert.equal(await hasAdsEditorSession(good), true);
    assert.equal(sameOrigin(good), true);
    const foreign = new NextRequest('https://serien.de/api/ads-editor', {
      headers: { host: 'serien.de', origin: 'https://foreign.example', cookie: `${ADS_EDITOR_COOKIE}=${token}` },
    });
    assert.equal(sameOrigin(foreign), false);
    assert.equal(await hasAdsEditorSession(new NextRequest('https://serien.de/api/ads-editor')), false);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test('single protected environment password works without revealing it to the client', async () => {
  const oldSecret = process.env.JWT_SECRET;
  const oldPassword = process.env.ADS_EDITOR_PASSWORD;
  const oldHash = process.env.ADS_EDITOR_PASSWORD_HASH;
  process.env.JWT_SECRET = 'test-only-signing-key-with-at-least-32-characters';
  process.env.ADS_EDITOR_PASSWORD = 'synthetic-test-password';
  delete process.env.ADS_EDITOR_PASSWORD_HASH;
  try {
    assert.equal(adsEditorConfigured(), true);
    assert.equal(await matchesAdsEditorPassword('synthetic-test-password'), true);
    assert.equal(await matchesAdsEditorPassword('wrong-password'), false);
  } finally {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    if (oldPassword === undefined) delete process.env.ADS_EDITOR_PASSWORD;
    else process.env.ADS_EDITOR_PASSWORD = oldPassword;
    if (oldHash === undefined) delete process.env.ADS_EDITOR_PASSWORD_HASH;
    else process.env.ADS_EDITOR_PASSWORD_HASH = oldHash;
  }
});
