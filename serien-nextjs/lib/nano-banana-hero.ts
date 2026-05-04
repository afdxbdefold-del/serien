/**
 * Nano-Banana (Gemini) hero-image generator.
 *
 * Used as a fallback when an article has no TMDB backdrop available.
 * Returns a public Vercel-Blob URL for a generated 16:9 cinematic
 * backdrop. Cache-key is deterministic per (tmdbId, slot) so we never
 * regenerate for the same show/category combo.
 *
 * Flow:
 *   1. Build a cache key `nano-banana/{tmdbId}-{slot}.png`.
 *   2. HEAD the Vercel-Blob URL. If 200 → return cached URL (no LLM spend).
 *   3. Otherwise, spawn `scripts/py/gen-nano-banana-hero.py` with a German
 *      prompt → receive PNG bytes on disk → upload to Blob → return URL.
 *
 * Never throws: on any failure returns null so the caller falls back to
 * the existing Sharp-composite hero.
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { put } from '@vercel/blob';

const PY_SCRIPT = path.resolve(__dirname, '..', 'scripts', 'py', 'gen-nano-banana-hero.py');

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
  // Keep prompt short — Gemini image-gen scales poorly with long prompts.
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

function runPython(outPath: string, sessionId: string, prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('python3', [PY_SCRIPT, outPath, sessionId], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        console.log(`   ⚠️ Nano Banana exit ${code}: ${stderr.trim().slice(-400)}`);
      } else if (stderr.trim()) {
        console.log(`   🎨 Nano Banana ${stderr.trim().slice(-200)}`);
      }
      resolve(code === 0);
    });
    proc.on('error', (err) => {
      console.log(`   ⚠️ Nano Banana spawn failed: ${err.message}`);
      resolve(false);
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * Main entry point.
 * @returns public Blob URL, or null on any failure.
 */
export async function generateNanoBananaHero(
  input: NanoBananaHeroInput,
): Promise<string | null> {
  if (!process.env.EMERGENT_LLM_KEY) return null;
  // tmdbId ist jetzt optional; nur seriesName ist Pflicht (für Cache-Key + Prompt).
  if (!input.seriesName || input.seriesName.trim().length === 0) return null;

  const blobKey = buildBlobKey(input.tmdbId, input.seriesName, input.slot);

  // 1. Cache hit?
  const cached = await getCachedUrl(blobKey);
  if (cached) return cached;

  // 2. Generate in a temp file.
  const idForTmp = input.tmdbId && input.tmdbId > 0 ? input.tmdbId : `name-${hashSeriesName(input.seriesName.toLowerCase().trim())}`;
  const tmp = path.join(
    os.tmpdir(),
    `nano-banana-${idForTmp}-${Date.now()}.bin`,
  );
  const prompt = buildPrompt(input);
  const sessionId = `nb-${idForTmp}-${normaliseSlot(input.slot)}-${Date.now()}`;

  const ok = await runPython(tmp, sessionId, prompt);
  if (!ok) {
    console.log(`   ⚠️ Nano Banana python step failed, falling back`);
    try { await fs.unlink(tmp); } catch {}
    return null;
  }

  // 3. Upload to Vercel Blob. Sniff mime from magic bytes so the
  //    Content-Type header matches the actual payload.
  try {
    const buf = await fs.readFile(tmp);
    const contentType = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
      ? 'image/jpeg'
      : buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e
        ? 'image/png'
        : 'application/octet-stream';
    const res = await put(blobKey, buf, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
    });
    await fs.unlink(tmp).catch(() => {});
    return res.url;
  } catch (err: any) {
    // "already exists" race → build canonical URL from base.
    const msg = String(err?.message ?? '');
    if (/already exists/i.test(msg)) {
      const base = getBlobBase();
      await fs.unlink(tmp).catch(() => {});
      if (base) return `${base.replace(/\/+$/, '')}/${blobKey}`;
    }
    console.log(`   ⚠️ Nano Banana Blob upload failed: ${msg || err}`);
    await fs.unlink(tmp).catch(() => {});
    return null;
  }
}
