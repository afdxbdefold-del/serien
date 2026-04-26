/**
 * Facebook Auto-Poster Admin API
 *
 * GET  /api/admin/facebook              → Status (Toggle, Token-Info, letzte Posts)
 * POST /api/admin/facebook/toggle       → Toggle Auto-Post On/Off
 * POST /api/admin/facebook/test         → Sendet Test-Post auf FB-Page
 * POST /api/admin/facebook/post-article → Manueller Post eines Artikels { slug }
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getBoolSetting, setSetting, SETTINGS } from '@/lib/app-settings';
import {
  postArticleToFacebook,
  sendFacebookTestPost,
  getFacebookTokenInfo,
} from '@/lib/facebook-poster';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'admin') return null;
    return String(payload.email || payload.username || 'admin');
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [enabled, tokenInfo, recent, totalSuccess, totalFailed] = await Promise.all([
    getBoolSetting(SETTINGS.FACEBOOK_AUTOPOST_ENABLED, false),
    getFacebookTokenInfo(),
    prisma.facebook_post_log.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        articleSlug: true,
        fbPostId: true,
        success: true,
        statusCode: true,
        errorMessage: true,
        trigger: true,
        createdAt: true,
      },
    }),
    prisma.facebook_post_log.count({ where: { success: true } }),
    prisma.facebook_post_log.count({ where: { success: false } }),
  ]);

  return NextResponse.json({
    autopostEnabled: enabled,
    tokenInfo,
    recent,
    stats: { totalSuccess, totalFailed },
  });
}

export async function POST(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const body = await req.json().catch(() => ({}));

  if (action === 'toggle') {
    const enabled = Boolean(body.enabled);
    await setSetting(SETTINGS.FACEBOOK_AUTOPOST_ENABLED, enabled ? 'true' : 'false', user);
    return NextResponse.json({ ok: true, enabled });
  }

  if (action === 'test') {
    const result = await sendFacebookTestPost();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (action === 'post-article') {
    const slug = String(body.slug || '');
    if (!slug) return NextResponse.json({ error: 'slug fehlt' }, { status: 400 });
    const result = await postArticleToFacebook(slug, 'manual');
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
