/**
 * Smoke-Test für decodeServiceAccountJson:
 * füttert alle 5 erwarteten Format-Varianten und prüft, dass jede sauber
 * dekodiert + das richtige `format`-Label zurückgibt.
 *
 * Run:  npx tsx scripts/test-decode-sa.ts
 */
import { checkIndexingApiHealth } from '../lib/google-indexing';

const FAKE_SA = {
  type: 'service_account',
  project_id: 'serien-de-test',
  private_key_id: 'fake',
  private_key: '-----BEGIN PRIVATE KEY-----\nFAKEKEY\n-----END PRIVATE KEY-----\n',
  client_email: 'test@serien-de-test.iam.gserviceaccount.com',
  client_id: '0',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

const json = JSON.stringify(FAKE_SA);
const b64 = Buffer.from(json).toString('base64');
const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const cases: { label: string; value: string; expect: string }[] = [
  { label: 'plain JSON', value: json, expect: 'plain' },
  { label: 'quoted JSON', value: JSON.stringify(json), expect: 'plain-unquoted' },
  { label: 'standard base64', value: b64, expect: 'base64' },
  { label: 'url-safe base64', value: b64url, expect: 'base64url' },
  { label: 'url-encoded JSON', value: encodeURIComponent(json), expect: 'url-encoded' },
];

(async () => {
  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = c.value;
    const h = await checkIndexingApiHealth();
    const ok = h.jsonParsed && h.detectedFormat === c.expect && !!h.serviceAccountEmail;
    if (ok) {
      pass++;
      console.log(`  ✅ ${c.label} → format=${h.detectedFormat}`);
    } else {
      fail++;
      console.log(`  ❌ ${c.label} → got format=${h.detectedFormat}, parsed=${h.jsonParsed}, err=${h.errors.join(' | ')}`);
    }
  }
  console.log(`\n${pass}/${cases.length} OK · ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();
