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

async function getAuthClient() {
  if (authClient) return authClient;

  const jsonBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (!jsonBase64) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var nicht gesetzt');
  }

  const credentials = JSON.parse(Buffer.from(jsonBase64, 'base64').toString('utf-8'));

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  authClient = await auth.getClient();
  return authClient;
}

/**
 * Sendet eine URL an die Google Indexing API
 */
export async function notifyGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getAuthClient();
    
    const response = await client.request({
      url: INDEXING_API_URL,
      method: 'POST',
      data: {
        url,
        type,
      },
    });

    const data = response.data;
    console.log(`   Google Indexing: ${url} → ${type} (${response.status})`);
    
    return { success: true };
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.error?.message || error.message;
    
    console.error(`   Google Indexing Fehler: ${status} - ${message}`);
    
    return { 
      success: false, 
      error: `${status}: ${message}` 
    };
  }
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
export async function indexNewArticle(slug: string): Promise<void> {
  const baseUrl = process.env.GOOGLE_INDEXING_BASE_URL || 'https://serien.de';
  const articleUrl = `${baseUrl}/${slug}`;

  const result = await notifyGoogleIndexing(articleUrl, 'URL_UPDATED');

  if (result.success) {
    console.log(`   Google Indexing: Artikel "${slug}" erfolgreich gemeldet`);
  } else {
    console.log(`   Google Indexing: Fehler bei "${slug}" - ${result.error}`);
  }

  // Prewarm News-Sitemap: purge Vercel Edge Cache so the next Googlebot fetch
  // sees the new <url> entry + refreshed Last-Modified immediately instead of
  // waiting for the 60s CDN TTL to expire.
  await prewarmNewsSitemap();
}

/**
 * Triggers revalidation of /news-sitemap.xml via an internal server-to-server
 * call to /api/internal/revalidate-sitemap. Authenticated with JWT_SECRET.
 * Silent no-op if prerequisites are missing (e.g. local script context without
 * a reachable baseUrl). Safe to call from anywhere, including standalone
 * Node.js scripts.
 */
export async function prewarmNewsSitemap(): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.GOOGLE_INDEXING_BASE_URL || 'https://serien.de';
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.log('   Sitemap-Prewarm: JWT_SECRET fehlt - übersprungen');
    return { success: false, error: 'JWT_SECRET missing' };
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
      return { success: true };
    }

    const text = await response.text().catch(() => '');
    console.log(`   Sitemap-Prewarm: ${response.status} - ${text.substring(0, 100)}`);
    return { success: false, error: `${response.status}: ${text.substring(0, 100)}` };
  } catch (error: any) {
    console.log(`   Sitemap-Prewarm Fehler: ${error.message}`);
    return { success: false, error: error.message };
  }
}
