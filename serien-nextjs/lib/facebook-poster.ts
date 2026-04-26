/**
 * Facebook Page Auto-Poster
 *
 * Postet einen veröffentlichten Artikel auf die Facebook-Seite via Graph API.
 * Loggt jeden Versuch in `facebook_post_log` für Debug & Audit.
 *
 * Setup-Voraussetzung:
 *   FACEBOOK_PAGE_ID            – Numerische Page-ID
 *   FACEBOOK_PAGE_ACCESS_TOKEN  – Long-Lived Page Access Token (60 Tage)
 *
 * Toggle-Steuerung:
 *   app_settings.facebook.autopost.enabled  – "true" | "false"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GRAPH_VERSION = 'v21.0';
const SITE_BASE = 'https://serien.de';

interface PostResult {
  success: boolean;
  fbPostId?: string;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * Postet einen Artikel auf die Facebook-Seite.
 * Idempotent: prüft, ob bereits ein erfolgreicher Post existiert, und überspringt dann.
 */
export async function postArticleToFacebook(
  slug: string,
  trigger: 'auto' | 'manual' = 'auto'
): Promise<PostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    const err = 'FACEBOOK_PAGE_ID oder FACEBOOK_PAGE_ACCESS_TOKEN fehlt in ENV';
    await logPost(slug, false, null, null, null, err, trigger);
    return { success: false, errorMessage: err };
  }

  // Idempotenz: Skip wenn bereits erfolgreich gepostet
  if (trigger === 'auto') {
    const existing = await prisma.facebook_post_log.findFirst({
      where: { articleSlug: slug, success: true },
    });
    if (existing) {
      return { success: true, fbPostId: existing.fbPostId ?? undefined };
    }
  }

  const article = await prisma.articles.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      metaDescription: true,
      status: true,
    },
  });

  if (!article) {
    const err = `Artikel nicht gefunden: ${slug}`;
    await logPost(slug, false, null, null, null, err, trigger);
    return { success: false, errorMessage: err };
  }

  if (article.status !== 'published') {
    const err = `Artikel ist nicht published (status=${article.status})`;
    await logPost(slug, false, null, null, null, err, trigger);
    return { success: false, errorMessage: err };
  }

  const url = `${SITE_BASE}/${slug}`;
  // Trailing-Slash-Trick: differs from canonical URL → FB strippt nicht aus Text-Body.
  // Beim Klick führt Next.js einen 308-Redirect auf die saubere URL durch.
  // Tracking läuft über GA4-Referrer-Attribution (facebook.com) — keine sichtbare UTM nötig.
  const displayUrl = `${url}/`;
  const teaser = (article.metaDescription || article.excerpt || '').trim();
  const message = teaser ? `${teaser}\n${displayUrl}` : `${article.title}\n${displayUrl}`;

  try {
    const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
    const body = new URLSearchParams({
      message,
      link: url,
      access_token: token,
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const status = res.status;
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };

    if (res.ok && json.id) {
      console.log(`   📘 Facebook: Post erfolgreich → ${json.id}`);
      await logPost(slug, true, json.id, status, message, null, trigger);
      return { success: true, fbPostId: json.id, statusCode: status };
    }

    const errMsg = json.error?.message || `HTTP ${status}`;
    console.error(`   📘 Facebook Fehler: ${errMsg}`);
    await logPost(slug, false, null, status, message, errMsg, trigger);
    return { success: false, statusCode: status, errorMessage: errMsg };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error(`   📘 Facebook Exception: ${errMsg}`);
    await logPost(slug, false, null, null, message, errMsg, trigger);
    return { success: false, errorMessage: errMsg };
  }
}

/**
 * Sendet einen Test-Post (nur für Admin-Verbindungs-Check)
 */
export async function sendFacebookTestPost(): Promise<PostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return { success: false, errorMessage: 'ENV fehlt' };

  const message = `🧪 Verbindungstest von serien.de Admin-Panel — ${new Date().toLocaleString('de-DE')}`;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message, access_token: token }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (res.ok && json.id) {
      return { success: true, fbPostId: json.id, statusCode: res.status };
    }
    return { success: false, statusCode: res.status, errorMessage: json.error?.message || `HTTP ${res.status}` };
  } catch (error: any) {
    return { success: false, errorMessage: error?.message || String(error) };
  }
}

/**
 * Holt Token-Metadaten via /debug_token (Expiry, Scopes, Validity)
 */
export async function getFacebookTokenInfo(): Promise<{
  valid: boolean;
  type?: string;
  expiresAt?: number;
  scopes?: string[];
  pageName?: string;
  pageId?: string;
  error?: string;
}> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return { valid: false, error: 'ENV fehlt' };

  try {
    const [debugRes, meRes] = await Promise.all([
      fetch(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${token}&access_token=${token}`),
      fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me?access_token=${token}`),
    ]);
    const debug = (await debugRes.json()) as any;
    const me = (await meRes.json()) as any;

    if (debug?.data?.is_valid) {
      return {
        valid: true,
        type: debug.data.type,
        expiresAt: debug.data.expires_at,
        scopes: debug.data.scopes,
        pageId: me?.id,
        pageName: me?.name,
      };
    }
    return { valid: false, error: debug?.data?.error?.message || 'Token ungültig' };
  } catch (error: any) {
    return { valid: false, error: error?.message || String(error) };
  }
}

async function logPost(
  slug: string,
  success: boolean,
  fbPostId: string | null,
  statusCode: number | null,
  message: string | null,
  errorMessage: string | null,
  trigger: 'auto' | 'manual'
): Promise<void> {
  try {
    await prisma.facebook_post_log.create({
      data: {
        articleSlug: slug,
        success,
        fbPostId,
        statusCode,
        message,
        errorMessage,
        trigger,
      },
    });
  } catch (e) {
    console.error('   📘 Facebook log write failed:', e);
  }
}
