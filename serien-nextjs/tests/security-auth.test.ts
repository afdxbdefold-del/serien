import assert from 'node:assert/strict';
import { SignJWT } from 'jose/jwt/sign';
import { NextRequest } from 'next/server';
import { verifyAdminRequest } from '../lib/admin-auth';
import { requireCronAuth } from '../lib/cron-auth';
import { requireInternalAuth } from '../lib/internal-auth';
import { isAllowedPushEndpoint, parsePushSubscription } from '../lib/push-validation';

const original = {
  JWT_SECRET: process.env.JWT_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  PUSH_ALLOWED_HOSTS: process.env.PUSH_ALLOWED_HOSTS,
};

let passed = 0;
function pass(message: string) {
  passed += 1;
  console.log(`PASS ${passed}) ${message}`);
}

async function main() {
try {
  delete process.env.CRON_SECRET;
  const cronUnconfigured = requireCronAuth(new Request('https://serien.de/api/cron/news'));
  assert.equal(cronUnconfigured?.status, 503);
  pass('cron auth fails closed when CRON_SECRET is missing');

  process.env.CRON_SECRET = 'cron-test-secret';
  const cronQueryOnly = requireCronAuth(
    new Request('https://serien.de/api/cron/news?secret=cron-test-secret'),
  );
  assert.equal(cronQueryOnly?.status, 401);
  pass('cron auth rejects a secret in the query string');

  const cronAuthorized = requireCronAuth(
    new Request('https://serien.de/api/cron/news', {
      headers: { Authorization: 'Bearer cron-test-secret' },
    }),
  );
  assert.equal(cronAuthorized, null);
  pass('cron auth accepts the configured bearer token');

  delete process.env.REVALIDATE_SECRET;
  const internalUnconfigured = requireInternalAuth(
    new Request('https://serien.de/api/internal/revalidate'),
  );
  assert.equal(internalUnconfigured?.status, 503);
  pass('internal auth fails closed when REVALIDATE_SECRET is missing');

  process.env.REVALIDATE_SECRET = 'revalidate-test-secret';
  const internalAuthorized = requireInternalAuth(
    new Request('https://serien.de/api/internal/revalidate', {
      headers: { Authorization: 'Bearer revalidate-test-secret' },
    }),
  );
  assert.equal(internalAuthorized, null);
  pass('internal auth accepts only its dedicated bearer token');

  delete process.env.PUSH_ALLOWED_HOSTS;
  assert.equal(
    isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example-token'),
    true,
  );
  pass('push validation accepts a known browser push service');

  assert.equal(isAllowedPushEndpoint('https://example.com/internal-callback'), false);
  pass('push validation rejects arbitrary HTTPS endpoints');

  assert.equal(isAllowedPushEndpoint('https://127.0.0.1/push'), false);
  pass('push validation rejects IP-literal endpoints');

  const validSubscription = parsePushSubscription({
    endpoint: 'https://fcm.googleapis.com/fcm/send/example-token',
    keys: { p256dh: 'A'.repeat(87), auth: 'b'.repeat(22) },
  });
  assert.ok(validSubscription);
  pass('push validation accepts bounded base64url keys');

  assert.equal(parsePushSubscription({
    endpoint: 'https://fcm.googleapis.com/fcm/send/example-token',
    keys: { p256dh: 'A'.repeat(2_000), auth: 'b'.repeat(22) },
  }), null);
  pass('push validation rejects oversized key material');

  process.env.PUSH_ALLOWED_HOSTS = '*.push.example.org';
  assert.equal(isAllowedPushEndpoint('https://tenant.push.example.org/v1/token'), true);
  pass('push validation supports explicit wildcard host extensions');

  delete process.env.JWT_SECRET;
  const noJwtSecret = await verifyAdminRequest(
    new NextRequest('https://serien.de/api/admin/dashboard'),
  );
  assert.equal(noJwtSecret, false);
  pass('admin auth fails closed when JWT_SECRET is missing');

  process.env.JWT_SECRET = 'jwt-test-secret-with-enough-entropy';
  const userToken = await new SignJWT({ userId: 'user-1', role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(
    await verifyAdminRequest(
      new NextRequest('https://serien.de/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${userToken}` },
      }),
    ),
    false,
  );
  pass('admin auth rejects a valid non-admin token');

  const adminToken = await new SignJWT({ userId: 'admin-1', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(
    await verifyAdminRequest(
      new NextRequest('https://serien.de/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ),
    true,
  );
  pass('admin auth accepts a signed admin bearer token');

  assert.equal(
    await verifyAdminRequest(
      new NextRequest('https://serien.de/api/admin/dashboard', {
        headers: { Cookie: `auth-token=${adminToken}` },
      }),
    ),
    true,
  );
  pass('admin auth accepts the signed admin session cookie');

  console.log(`\n${passed} passed, 0 failed`);
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
