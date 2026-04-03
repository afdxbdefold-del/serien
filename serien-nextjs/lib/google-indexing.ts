/**
 * GOOGLE INDEXING API
 * 
 * Benachrichtigt Google sofort über neue/aktualisierte URLs.
 * Nutzt die Web Search Indexing API v3.
 * 
 * Voraussetzungen:
 * - Google Cloud Projekt mit aktivierter Indexing API
 * - Service Account JSON Key
 * - Service Account als Inhaber in Google Search Console verifiziert
 */

import { GoogleAuth } from 'google-auth-library';
import * as path from 'path';

const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

let authClient: any = null;

async function getAuthClient() {
  if (authClient) return authClient;

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_PATH)
    : path.resolve(process.cwd(), 'google-service-account.json');

  const auth = new GoogleAuth({
    keyFile: keyPath,
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
 */
export async function indexNewArticle(slug: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.wiki';
  const articleUrl = `${baseUrl}/${slug}`;
  
  const result = await notifyGoogleIndexing(articleUrl, 'URL_UPDATED');
  
  if (result.success) {
    console.log(`   Google Indexing: Artikel "${slug}" erfolgreich gemeldet`);
  } else {
    console.log(`   Google Indexing: Fehler bei "${slug}" - ${result.error}`);
  }
}
