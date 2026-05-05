/**
 * AI-Hero-Image Generator (gpt-image-1 via Emergent LLM-Proxy).
 *
 * Used as a fallback when an article has no TMDB backdrop available.
 * Returns a public Vercel-Blob URL for a generated 16:9 cinematic
 * backdrop. Cache-key is deterministic per (tmdbId, slot) so we never
 * regenerate for the same show/category combo.
 *
 * Flow:
 *   1. Build a cache key `nano-banana/{tmdbId}-{slot}.jpg`.
 *   2. HEAD the Vercel-Blob URL. If 200 → return cached URL (no LLM spend).
 *   3. Otherwise, call OpenAI `images.generate` (gpt-image-1) via the
 *      Emergent LLM-Proxy → receive base64 → upload to Blob → return URL.
 *
 * Wir nutzen NICHT mehr `python3` (Vercel Node-Serverless hat kein Python).
 * Das `emergentintegrations`-Python-Paket war Quelle des Bugs: der Spawn
 * scheiterte still auf Vercel, Pipeline fiel auf Composite-Hero zurück.
 *
 * Never throws: on any failure returns null so the caller falls back to
 * the existing Sharp-composite hero.
 */
import { put } from '@vercel/blob';
import OpenAI from 'openai';

function getBlobBase(): string {
  return process.env.BLOB_PUBLIC_URL || process.env.NEXT_PUBLIC_BLOB_URL || '';
}

export interface NanoBananaHeroInput {
  /**
   * TMDB ID, optional. Wird als primary Cache-Key verwendet wenn vorhanden.
   * Wenn null/undefined: Cache-Key fällt auf einen Hash der `seriesName`
   * zurück, damit auch Artikel ohne TMDB-Match einen Nano-Banana-Hero
   * bekommen — genau die Artikel, für die der Fallback gedacht ist.
   */
  tmdbId?: number | null;
  seriesName: string;
  /**
   * Extra variance token so different article-slots (e.g. trailer vs.
   * finale vs. casting) get distinct images even for the same series.
   * Max 32 lowercase-alphanum chars; non-matching chars are stripped.
   */
  slot: string;
  /**
   * Optional category hint (e.g. "Trailer", "Casting", "Finale") used
   * in the prompt to steer the composition.
   */
  category?: string;
  /**
   * Optional ['Netflix', 'HBO Max', …] — used to hint platform tonality
   * (streamers skew cinematic; anime platforms skew stylised).
   */
  networks?: string[];
}

function normaliseSlot(slot: string): string {
  return (slot || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'default';
}

/**
 * Stabiler 8-stelliger DJB2-Hash über die Series-Name. Wird als Cache-Key-
 * Suffix verwendet, wenn keine TMDB-ID vorliegt. Idempotent.
 */
function hashSeriesName(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) ^ name.charCodeAt(i); // hash * 33 ^ char
  }
  // Hash kann negativ werden — wir wollen ein konsistentes positives 8-Hex.
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

function buildBlobKey(tmdbId: number | null | undefined, seriesName: string, slot: string): string {
  const id = tmdbId && tmdbId > 0 ? String(tmdbId) : `name-${hashSeriesName(seriesName.toLowerCase().trim())}`;
  return `nano-banana/${id}-${normaliseSlot(slot)}.jpg`;
}

function buildPrompt(input: NanoBananaHeroInput): string {
  const platformHint = input.networks && input.networks.length > 0
    ? `Die Serie läuft auf ${input.networks.slice(0, 2).join(' / ')}.`
    : '';
  const categoryHint = input.category
    ? `Artikel-Kontext: ${input.category}.`
    : '';
  return [
    `Erzeuge ein kinematisches 16:9-Hero-Bild im Widescreen-Format für einen deutschen Serien-News-Artikel über "${input.seriesName}".`,
    categoryHint,
    platformHint,
    'Stil: atmosphärisch, dramatisch, filmisch gerendert, weiche Beleuchtung, Tiefenunschärfe, leichte Vignette.',
    'Keine Gesichter von echten Schauspielern, keine Logos, keine Wasserzeichen, KEIN TEXT im Bild.',
    'Szenische Komposition mit Stimmung der Serie; Blickpunkte links und rechts für spätere UI-Overlays frei.',
  ].filter(Boolean).join(' ');
}

/**
 * HEAD-check the Vercel-Blob URL. Returns the public URL if already present.
 * Cheaper than re-uploading and avoids duplicate LLM spend.
 */
async function getCachedUrl(blobKey: string): Promise<string | null> {
  const base = getBlobBase();
  if (!base) return null;
  const url = `${base.replace(/\/+$/, '')}/${blobKey}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return url;
  } catch { /* network issue → treat as cache miss */ }
  return null;
}

/**
 * Generate image via OpenAI gpt-image-1 routed through the Emergent LLM-Proxy.
 * Returns raw bytes + content-type, or null on any failure.
 */
async function generateImageBytes(prompt: string): Promise<{ buf: Buffer; contentType: string } | null> {
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const isEmergent = !!process.env.EMERGENT_LLM_KEY;
  const client = new OpenAI({
    apiKey,
    baseURL: isEmergent ? 'https://integrations.emergentagent.com/llm' : 'https://api.openai.com/v1',
  });
  try {
    const res = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      // 1536x1024 ist die nächste 16:9-nahe Größe, die gpt-image-1 unterstützt.
      // Wird vom Frontend bei Bedarf nochmal nachgecroppt.
      size: '1536x1024',
      n: 1,
    } as any);
    const item: any = res.data?.[0];
    const b64 = item?.b64_json;
    if (!b64) {
      console.log(`   ⚠️ gpt-image-1 Antwort enthielt kein b64_json (keys=${Object.keys(item || {}).join(',')})`);
      return null;
    }
    const buf = Buffer.from(b64, 'base64');
    // Magic-byte Sniffing für korrekten Content-Type
    const contentType = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
      ? 'image/jpeg'
      : buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e
        ? 'image/png'
        : 'application/octet-stream';
    return { buf, contentType };
  } catch (e: any) {
    console.log(`   ⚠️ gpt-image-1 Aufruf fehlgeschlagen: ${e?.message?.slice(0, 300) || e}`);
    return null;
  }
}

/**
 * Main entry point.
 * @returns public Blob URL, or null on any failure.
 */
export async function generateNanoBananaHero(
  input: NanoBananaHeroInput,
): Promise<string | null> {
  if (!process.env.EMERGENT_LLM_KEY && !process.env.OPENAI_API_KEY) return null;
  if (!input.seriesName || input.seriesName.trim().length === 0) return null;

  const blobKey = buildBlobKey(input.tmdbId, input.seriesName, input.slot);

  // 1. Cache hit?
  const cached = await getCachedUrl(blobKey);
  if (cached) return cached;

  // 2. Generate via gpt-image-1 (pure Node, läuft auf Vercel).
  const prompt = buildPrompt(input);
  const generated = await generateImageBytes(prompt);
  if (!generated) {
    console.log(`   ⚠️ Hero-Generation fehlgeschlagen, Fallback auf Composite`);
    return null;
  }

  // 3. Upload to Vercel Blob.
  try {
    const res = await put(blobKey, generated.buf, {
      access: 'public',
      addRandomSuffix: false,
      contentType: generated.contentType,
    });
    return res.url;
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    // "already exists" race → build canonical URL from base.
    if (/already exists/i.test(msg)) {
      const base = getBlobBase();
      if (base) return `${base.replace(/\/+$/, '')}/${blobKey}`;
    }
    console.log(`   ⚠️ Hero-Image Blob-Upload fehlgeschlagen: ${msg || err}`);
    return null;
  }
}
