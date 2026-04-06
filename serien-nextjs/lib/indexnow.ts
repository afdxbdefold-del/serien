/**
 * IndexNow API — Sofortige Benachrichtigung an Bing, Yandex, Seznam etc.
 */

const HOST = 'serien.de';
const KEY = '8e6827d79c19f8cbe91089129c21e303';
const BASE = `https://${HOST}`;

export async function submitToIndexNow(urls: string[]): Promise<{ success: boolean; status: number; error?: string }> {
  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${BASE}/${KEY}.txt`,
        urlList: urls,
      }),
    });

    const status = res.status;
    if (status === 200 || status === 202) {
      console.log(`   IndexNow: ${urls.length} URL(s) eingereicht (${status})`);
      return { success: true, status };
    }

    const text = await res.text().catch(() => '');
    console.error(`   IndexNow Fehler: ${status} - ${text.substring(0, 200)}`);
    return { success: false, status, error: text.substring(0, 200) };
  } catch (error: any) {
    console.error(`   IndexNow Fehler: ${error.message}`);
    return { success: false, status: 0, error: error.message };
  }
}

/**
 * Benachrichtigt IndexNow über einen neuen Artikel
 */
export async function indexNowArticle(slug: string): Promise<void> {
  const url = `${BASE}/${slug}`;
  await submitToIndexNow([url]);
}
