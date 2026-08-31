/**
 * GOOGLE INDEXING API
 * 
 * Benachrichtigt Google sofort über neue/aktualisierte URLs.
 * Nutzt die Web Search Indexing API v3.
 * 
 * Voraussetzungen:
 * - Google Cloud Projekt mit aktivierter Indexing API
 * - Service Account JSON Key (als GOOGLE_SERVICE_ACCOUNT_JSON env var, Base64-kodiert)
 * - Service Account als Inhaber in Google Search Console verifiziert
 */

import { GoogleAuth } from 'google-auth-library';

const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

let authClient: any = null;

/**
 * Decodiert den Service-Account-JSON aus der ENV-Variable.
 *
 * Probiert (in dieser Reihenfolge) alle gängigen Vercel-Pannen durch:
 *   1. Plain JSON (`{...}`)
 *   2. Plain JSON in Quotes gewrappt (`"{...}"` mit escapten Newlines)
 *   3. Standard-Base64 (empfohlen)
 *   4. URL-safe Base64 (`-_` statt `+/`)
 *   5. URL-decoded → JSON
 *
 * Validiert das Ergebnis (`client_email` + `private_key` müssen vorhanden sein),
 * sonst wird die nächste Variante probiert.
 */
type DecodeFormat = 'plain' | 'plain-unquoted' | 'base64' | 'base64url' | 'url-encoded';

function looksLikeServiceAccount(obj: any): boolean {
  return !!(obj && typeof obj === 'object' && obj.client_email && obj.private_key);
}

function decodeServiceAccountJson(raw: string): {
  creds: any;
  decoded: string;
  format: DecodeFormat;
} {
  const trimmed = raw.trim();
  const attempts: { format: DecodeFormat; produce: () => string }[] = [
    { format: 'plain', produce: () => trimmed },
    {
      format: 'plain-unquoted',
      produce: () => {
        // Vercel/dotenv wrappt manchmal JSON in Quotes. JSON.parse aufs
        // Outer-Wrapper macht das Unescaping atomar (keine fragilen Regex).
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          const inner = JSON.parse(trimmed);
          if (typeof inner !== 'string') throw new Error('outer parse lieferte non-string');
          return inner;
        }
        throw new Error('not quote-wrapped');
      },
    },
    { format: 'base64', produce: () => Buffer.from(trimmed, 'base64').toString('utf-8') },
    {
      format: 'base64url',
      produce: () => {
        const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
        // Re-pad
        const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
        return Buffer.from(normalized + pad, 'base64').toString('utf-8');
      },
    },
    { format: 'url-encoded', produce: () => decodeURIComponent(trimmed) },
  ];

  const errors: string[] = [];
  for (const a of attempts) {
    let decoded: string;
    try {
      decoded = a.produce();
    } catch (e: any) {
      errors.push(`${a.format}: ${e.message}`);
      continue;
    }
    // Cheap pre-check: must contain a key marker before we try to parse
    if (!decoded.includes('"type"') && !decoded.includes('service_account')) {
      errors.push(`${a.format}: keine Service-Account-Marker im Ergebnis`);
      continue;
    }
    try {
      const creds = JSON.parse(decoded);
      if (!looksLikeServiceAccount(creds)) {
        errors.push(`${a.format}: parsed OK aber client_email/private_key fehlt`);
        continue;
      }
      return { creds, decoded, format: a.format };
    } catch (e: any) {
      errors.push(`${a.format}: JSON.parse → ${e.message}`);
    }
  }

  throw new Error(
    `Konnte GOOGLE_SERVICE_ACCOUNT_JSON nicht dekodieren. Probiert: ${errors.join(' | ')}. ` +
      `Empfohlene Lösung: \`base64 -w0 service_account.json | pbcopy\` und den Inhalt 1:1 ` +
      `in Vercel als ENV-Wert einfügen (keine Quotes, keine Newlines, Standard-Base64-Alphabet).`,
  );
}

async function getAuthClient() {
  if (authClient) return authClient;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var nicht gesetzt');
  }

  const { creds } = decodeServiceAccountJson(raw);

  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  authClient = await auth.getClient();
  return authClient;
}

/**
 * Persist an Indexing API attempt to `google_indexing_api_logs` for the admin
 * observability dashboard. Best-effort — never throws (DB-Fehler darf den
 * Pipeline-Lauf nicht killen).
 */
async function logIndexingAttempt(args: {
  articleId?: string | null;
  url: string;
  eventType: 'publish' | 'update' | 'manual';
  requestPayload?: any;
  responseStatus?: number | null;
  responseBody?: string | null;
  success: boolean;
  errorMessage?: string | null;
}) {
  try {
    const { default: prisma } = await import('./prisma');
    await prisma.google_indexing_api_logs.create({
      data: {
        articleId: args.articleId ?? null,
        url: args.url,
        eventType: args.eventType,
        requestPayload: args.requestPayload ? JSON.stringify(args.requestPayload).slice(0, 2000) : null,
        responseStatus: args.responseStatus ?? null,
        responseBody: args.responseBody ? args.responseBody.slice(0, 2000) : null,
        success: args.success,
        errorMessage: args.errorMessage ? args.errorMessage.slice(0, 500) : null,
      },
    });
  } catch (e: any) {
    console.log(`   Google Indexing Log DB-Fehler: ${e.message}`);
  }
}

/**
 * Sendet eine URL an die Google Indexing API + persistiert das Ergebnis in
 * `google_indexing_api_logs` (Best-effort, blockt nie den Aufrufer).
 *
 * ⚠️ HINWEIS: Die Indexing API garantiert KEIN Indexing — sie ist offiziell
 * nur für JobPosting + BroadcastEvent gedacht. News-Artikel werden vom
 * Best-Effort-Crawler verarbeitet. Die News-Sitemap bleibt der primäre
 * Discovery-Mechanismus. Diese API ist nur ein zusätzlicher Push.
 */
export async function notifyGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
  options: { articleId?: string | null; eventType?: 'publish' | 'update' | 'manual' } = {},
): Promise<{ success: boolean; error?: string; status?: number }> {
  const eventType = options.eventType || (type === 'URL_DELETED' ? 'update' : 'publish');
  const payload = { url, type };

  try {
    const client = await getAuthClient();

    const response = await client.request({
      url: INDEXING_API_URL,
      method: 'POST',
      data: payload,
    });

    console.log(`   Google Indexing: ${url} → ${type} (${response.status})`);
    await logIndexingAttempt({
      articleId: options.articleId,
      url,
      eventType,
      requestPayload: payload,
      responseStatus: response.status,
      responseBody: response.data ? JSON.stringify(response.data) : null,
      success: true,
    });
    return { success: true, status: response.status };
  } catch (error: any) {
    const status = error?.response?.status ?? null;
    const message = error?.response?.data?.error?.message || error.message;

    console.error(`   Google Indexing Fehler: ${status} - ${message}`);
    await logIndexingAttempt({
      articleId: options.articleId,
      url,
      eventType,
      requestPayload: payload,
      responseStatus: status,
      responseBody: error?.response?.data ? JSON.stringify(error.response.data) : null,
      success: false,
      errorMessage: message,
    });
    return {
      success: false,
      error: `${status ?? 'no-status'}: ${message}`,
      status: status ?? undefined,
    };
  }
}

/**
 * End-to-end Health-Check der Indexing-API-Pipeline.
 *
 * Prüft (in Reihenfolge):
 *   1. ENV-Variable existiert
 *   2. Base64-Decode funktioniert
 *   3. JSON-Parse funktioniert + erwartete Felder vorhanden
 *   4. Service-Account-E-Mail extrahierbar
 *   5. Token-Generation läuft (= Auth funktioniert)
 *
 * KEIN echter API-Call — separat aufrufen wenn auch der Indexing-Endpoint
 * geprüft werden soll.
 */
export interface IndexingHealth {
  envSet: boolean;
  base64Decoded: boolean;
  jsonParsed: boolean;
  detectedFormat: DecodeFormat | null;
  serviceAccountEmail: string | null;
  projectId: string | null;
  tokenGenerated: boolean;
  envFingerprint: { length: number; head: string; tail: string; looksLike: string } | null;
  errors: string[];
}

/**
 * Produces a non-sensitive "fingerprint" of the env value so the user can
 * debug *what* is stored on Vercel without exposing the secret itself.
 * Returns: length, first 4 chars, last 4 chars, and a guess what it might be.
 */
function envFingerprint(raw: string): { length: number; head: string; tail: string; looksLike: string } {
  const trimmed = raw.trim();
  const len = trimmed.length;
  const head = trimmed.slice(0, 4);
  const tail = len > 8 ? trimmed.slice(-4) : '…';

  let looksLike = 'unbekannt';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) looksLike = 'plain JSON (aber invalid)';
  else if (trimmed.startsWith('"') && trimmed.endsWith('"')) looksLike = 'quoted string';
  else if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) looksLike = 'Standard-Base64 (aber dekodiert zu Müll)';
  else if (/^[A-Za-z0-9_-]+={0,2}$/.test(trimmed)) looksLike = 'URL-safe Base64';
  else if (trimmed.startsWith('%')) looksLike = 'URL-encoded';
  else if (trimmed.startsWith('-----BEGIN')) looksLike = 'PEM private key (nicht das ganze JSON!)';
  else if (trimmed.startsWith('eyJ')) looksLike = 'JWT-Token (nicht Service-Account!)';
  else if (trimmed.includes(' ') || trimmed.includes('\n')) looksLike = 'enthält Whitespace/Newlines';

  return { length: len, head, tail, looksLike };
}

export async function checkIndexingApiHealth(): Promise<IndexingHealth> {
  const out: IndexingHealth = {
    envSet: false,
    base64Decoded: false,
    jsonParsed: false,
    detectedFormat: null,
    serviceAccountEmail: null,
    projectId: null,
    tokenGenerated: false,
    envFingerprint: null,
    errors: [],
  };

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    out.errors.push('GOOGLE_SERVICE_ACCOUNT_JSON env var nicht gesetzt');
    return out;
  }
  out.envSet = true;
  out.envFingerprint = envFingerprint(raw);

  let creds: any;
  try {
    const result = decodeServiceAccountJson(raw);
    creds = result.creds;
    out.detectedFormat = result.format;
    out.base64Decoded = true;
    out.jsonParsed = true;
  } catch (e: any) {
    out.errors.push(e.message);
    return out;
  }

  out.serviceAccountEmail = creds.client_email ?? null;
  out.projectId = creds.project_id ?? null;
  if (!creds.client_email) out.errors.push('client_email fehlt im Service-Account-JSON');
  if (!creds.private_key) out.errors.push('private_key fehlt im Service-Account-JSON');

  // Token-Generation testen
  try {
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    const client = await auth.getClient();
    const token = await (client as any).getAccessToken();
    if (token?.token) out.tokenGenerated = true;
    else out.errors.push('Token-Generation lieferte kein Token zurück');
  } catch (e: any) {
    out.errors.push(`Token-Generation fehlgeschlagen: ${e.message}`);
  }

  return out;
}

/**
 * Benachrichtigt Google über einen neuen Artikel
 * Wird nach der Veröffentlichung in der Pipeline aufgerufen
 * Nutzt immer die Production-Domain (nicht Preview/Vercel URLs)
 *
 * Historisch gab es hier zusätzliche Sitemap-Pings an
 *   - https://www.google.com/ping?sitemap=…
 *   - https://pubsubhubbub.appspot.com/publish
 * Beide wurden von Google 2023 offiziell abgeschaltet und geben nur noch
 * 404/410 zurück. Sitemap-Updates werden jetzt rein über HTTP
 * Last-Modified / If-Modified-Since auf /news-sitemap.xml signalisiert.
 */
export async function indexNewArticle(slug: string, articleId?: string | null): Promise<void> {
  const baseUrl = process.env.GOOGLE_INDEXING_BASE_URL || 'https://serien.de';
  const articleUrl = `${baseUrl}/${slug}`;

  const result = await notifyGoogleIndexing(articleUrl, 'URL_UPDATED', {
    articleId: articleId ?? null,
    eventType: 'publish',
  });

  if (result.success) {
    console.log(`   Google Indexing: Artikel "${slug}" erfolgreich gemeldet`);
  } else {
    console.log(`   Google Indexing: Fehler bei "${slug}" - ${result.error}`);
  }

  // Prewarm News-Sitemap: purge Vercel Edge Cache so the next Googlebot fetch
  // sees the new <url> entry + refreshed Last-Modified immediately instead of
  // waiting for the 60s CDN TTL to expire.
  await prewarmNewsSitemap(slug);
}

/**
 * Triggers revalidation of /news-sitemap.xml via an internal server-to-server
 * call to /api/internal/revalidate-sitemap. Authenticated with REVALIDATE_SECRET.
 * Persists the outcome to sitemap_prewarm_log for the admin "Sitemap Health"
 * widget. Safe to call from anywhere, including standalone Node.js scripts.
 */
export async function prewarmNewsSitemap(
  articleSlug: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.GOOGLE_INDEXING_BASE_URL || 'https://serien.de';
  const secret = process.env.REVALIDATE_SECRET;
  const start = Date.now();

  const persist = async (
    success: boolean,
    statusCode: number | null,
    errorMessage: string | null,
  ) => {
    try {
      const { default: prisma } = await import('./prisma');
      await prisma.sitemap_prewarm_log.create({
        data: {
          articleSlug,
          success,
          statusCode: statusCode ?? undefined,
          errorMessage: errorMessage ?? undefined,
          durationMs: Date.now() - start,
        },
      });
    } catch (e: any) {
      console.log(`   Sitemap-Prewarm Log DB-Fehler: ${e.message}`);
    }
  };

  if (!secret) {
    console.log('   Sitemap-Prewarm: REVALIDATE_SECRET fehlt - übersprungen');
    await persist(false, null, 'REVALIDATE_SECRET missing');
    return { success: false, error: 'REVALIDATE_SECRET missing' };
  }

  try {
    const response = await fetch(`${baseUrl}/api/internal/revalidate-sitemap`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      // Don't let a stalled edge hang the pipeline
      signal: AbortSignal.timeout(5_000),
    });

    if (response.ok) {
      console.log(`   Sitemap-Prewarm: OK (${response.status})`);
      await persist(true, response.status, null);
      return { success: true };
    }

    const text = await response.text().catch(() => '');
    console.log(`   Sitemap-Prewarm: ${response.status} - ${text.substring(0, 100)}`);
    await persist(false, response.status, text.substring(0, 200));
    return { success: false, error: `${response.status}: ${text.substring(0, 100)}` };
  } catch (error: any) {
    console.log(`   Sitemap-Prewarm Fehler: ${error.message}`);
    await persist(false, null, error.message);
    return { success: false, error: error.message };
  }
}
