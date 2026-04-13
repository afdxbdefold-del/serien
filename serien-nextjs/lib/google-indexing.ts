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
 */
export async function indexNewArticle(slug: string): Promise<void> {
  const baseUrl = process.env.GOOGLE_INDEXING_BASE_URL || 'https://serien.de';
  const articleUrl = `${baseUrl}/${slug}`;
  
  // 1. Google Indexing API (URL-spezifisch)
  const result = await notifyGoogleIndexing(articleUrl, 'URL_UPDATED');
  
  if (result.success) {
    console.log(`   Google Indexing: Artikel "${slug}" erfolgreich gemeldet`);
  } else {
    console.log(`   Google Indexing: Fehler bei "${slug}" - ${result.error}`);
  }
  
  // 2. Google PubSubHubbub Sitemap-Ping (News-Sitemap hat sich geaendert)
  await pingSitemapToGoogle();
}

/**
 * Pingt Google via PubSubHubbub/WebSub dass die News-Sitemap aktualisiert wurde.
 * Dies ist der offiziell empfohlene Weg um Google ueber Sitemap-Aenderungen zu informieren.
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#addsitemap
 */
export async function pingSitemapToGoogle(): Promise<{ success: boolean; error?: string }> {
  const sitemapUrl = 'https://serien.de/news-sitemap.xml';
  
  try {
    // PubSubHubbub/WebSub Ping
    const response = await fetch('https://pubsubhubbub.appspot.com/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `hub.mode=publish&hub.url=${encodeURIComponent(sitemapUrl)}`,
    });
    
    if (response.ok || response.status === 204) {
      console.log(`   Sitemap-Ping: Google PubSubHubbub OK (${response.status})`);
      return { success: true };
    }
    
    const text = await response.text().catch(() => '');
    console.log(`   Sitemap-Ping: PubSubHubbub ${response.status} - ${text.substring(0, 100)}`);
    return { success: false, error: `${response.status}: ${text.substring(0, 100)}` };
  } catch (error: any) {
    console.log(`   Sitemap-Ping Fehler: ${error.message}`);
    return { success: false, error: error.message };
  }
}
