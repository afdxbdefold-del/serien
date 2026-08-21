#!/usr/bin/env node
/**
 * DEMO — "Ende erklärt" Generator for a single Cinemaholic URL
 *
 * Steps:
 *  1. Fetch source HTML
 *  2. Extract clean article text
 *  3. Single Claude call: extract facts (DE) + write new German "Ende erklärt" article
 *     — structured content, H2-Sections, FAQ, attribution footer
 *  4. Save as DRAFT article in DB (no publish)
 *  5. Print preview summary
 *
 * Usage: node scripts/demo-ende-erklaert.mjs <cinemaholic-url>
 */
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const API_KEY = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
if (!API_KEY) { console.error('Missing LLM API key'); process.exit(1); }
const isEmergent = API_KEY.startsWith('sk-emergent-');
const LLM_URL = isEmergent ? 'https://integrations.emergentagent.com/llm/chat/completions' : 'https://api.openai.com/v1/chat/completions';
const MODEL = isEmergent ? 'claude-sonnet-4-6' : 'gpt-5.4';

const prisma = new PrismaClient();

async function fetchArticle(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 serien-audit/1.0' } });
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  const html = await r.text();
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('title').text().trim();
  // Prefer article body
  const body = $('article').text() || $('.post-content, .entry-content, main').text() || $('body').text();
  const clean = body.replace(/\s+/g, ' ').trim().slice(0, 8000);
  return { title, text: clean };
}

async function llmJSON(system, user) {
  const r = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${await r.text()}`);
  const d = await r.json();
  let raw = d.choices?.[0]?.message?.content || '';
  if (raw.startsWith('```json')) raw = raw.slice(7);
  else if (raw.startsWith('```')) raw = raw.slice(3);
  if (raw.endsWith('```')) raw = raw.slice(0, -3);
  const m = raw.match(/[\[{][\s\S]*[\]}]/);
  const content = m ? m[0] : raw;
  try {
    return JSON.parse(content);
  } catch (e1) {
    // Most common failure: HTML with unescaped double-quotes inside body_html.
    // Strategy: inside string values, replace bare `"` with `\"` — done via a
    // streaming scan that tracks whether we're currently inside a JSON string.
    const sanitised = sanitiseJsonStrings(content)
      .replace(/„|"|"/g, "'")
      .replace(/[\x00-\x08\x0b-\x1f]/g, ' ');
    try {
      return JSON.parse(sanitised);
    } catch (e2) {
      console.error('  RAW LLM output (first 500 chars):', content.slice(0, 500));
      throw e2;
    }
  }
}

/**
 * Walk a JSON candidate character-by-character. When a value-string starts
 * (after `:` outside another string), escape any bare `"` that is NOT the
 * string's terminator. Good enough for cases where Claude forgets to escape
 * quotes inside an HTML value, which is the common failure.
 */
function sanitiseJsonStrings(src) {
  const out = [];
  let inString = false;
  let afterColon = false;
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    if (!inString) {
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (c === ':') afterColon = true;
      else if (c === ',' || c === '{' || c === '[') afterColon = false;
      if (c === '"') { inString = true; out.push(c); continue; }
      out.push(c);
      continue;
    }
    // inString
    if (c === '"' && prev !== '\\') {
      // Decide: is this an end-of-string or a content quote?
      // Lookahead: if the NEXT non-whitespace char is `,` `}` `]` or `:`, it's end.
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      const next = src[j];
      if (next === ',' || next === '}' || next === ']' || next === ':') {
        inString = false;
        out.push(c);
        continue;
      }
      // content quote → escape
      out.push('\\', '"');
      continue;
    }
    out.push(c);
  }
  return out.join('');
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

async function main(url) {
  if (!url) throw new Error('Usage: node scripts/demo-ende-erklaert.mjs <cinemaholic-url>');
  console.log(`\n📥 Fetching: ${url}`);
  const src = await fetchArticle(url);
  console.log(`   ↳ Title (EN): "${src.title}"`);
  console.log(`   ↳ Text length: ${src.text.length} chars\n`);

  console.log('🧠 Calling Claude (facts + DE article in one pass)...');
  const t0 = Date.now();
  const result = await llmJSON(
    `Du bist ein deutscher TV-Journalist. Du liest einen englischen "Ending Explained"-Recap und schreibst daraus einen völlig neuen deutschen Artikel für serien.de.

REGELN:
- ALLE Ausgaben auf Deutsch. Serientitel im englischen Original belassen.
- KEINE wörtliche Übersetzung. Inhalt neu strukturieren, eigene Formulierungen.
- Fokus: Was ist im Finale/Episode passiert? Wie ist es zu verstehen? Was bedeutet das für die nächste Staffel?
- Neutral-redaktioneller Ton. Keine Floskeln wie "In diesem Artikel…". Keine AI-Phrasen.
- Absätze 2-4 Sätze. Lesbar, flüssig.
- WARNHINWEIS: Erste Zeile des Fließtexts = Spoiler-Warnung als eigener Absatz.

AUSGABE als JSON mit Feldern:
{
  "seriesTitleEN": string,
  "seasonNumber": number|null,
  "episodeType": "finale" | "episode" | "standalone",
  "episodeNumber": number|null,
  "seriesTitleDE": string,      // deutscher oder internationaler Titel
  "newHeadline": string,        // 6-12 Wörter, "Ende erklärt" enthalten, Discover-tauglich
  "teaser": string,             // 1-2 Sätze, max 160 Zeichen
  "body_html": string,          // vollständiger Artikel als HTML: 1 Spoiler-Warnung + 3-5 H2-Sections + Absätze. NUR <h2>, <p>, <strong>, <em>. KEINE links, listen, bilder.
  "faq": [{ "q": string, "a": string }],  // 3 Q&A
  "key_facts": [string]         // 5 Bullet points: wichtigste Fakten des Finales, je 10-20 Wörter
}

BEACHTE:
- "newHeadline" MUSS **exakt** mit "Das Ende von <SERIENTITEL> <Staffel/Episode> erklärt:" beginnen und darf nach dem Doppelpunkt einen kurzen, konkreten Nachsatz enthalten (max. 10 Wörter).
  - Beispiele: "Das Ende von Envious Staffel 4 erklärt: Was Mars' letzter Blick bedeutet"
  - Beispiele: "Das Ende von Squid Game Staffel 2 erklärt: Darum stirbt der Spieler"
  - Nutze "Staffel N" bei Season-Finales, "Episode N" bei einzelnen Folgen, "Film" bei Standalone.
- "body_html" MIN 400 Wörter, MAX 900.
- KEINE Behauptungen, die nicht im Quelltext stehen. Wenn unklar → weglassen.`,
    `ENGLISCHER QUELL-ARTIKEL:

TITEL: ${src.title}

TEXT:
${src.text}

Jetzt JSON generieren.`
  );
  console.log(`   ↳ LLM took ${((Date.now()-t0)/1000).toFixed(1)}s\n`);

  // ──────────────────────────────────────────────────────────────────────
  // SAFETY-NET: "Ende erklärt"-Artikel MÜSSEN immer mit
  // "Das Ende von <Serie> <Staffel> erklärt: …" anfangen.
  // Falls Claude das Format nicht exakt trifft, bauen wir die Headline hier um.
  // ──────────────────────────────────────────────────────────────────────
  function enforceEndeErklaertFormat(headline, seriesTitleEN, episodeType, seasonNumber, episodeNumber) {
    const prefixRe = /^das\s+ende\s+von\s+.+?\s+erklärt\s*:/i;
    if (prefixRe.test(headline)) return headline; // already compliant
    const unit = episodeType === 'finale' && seasonNumber
      ? `Staffel ${seasonNumber}`
      : episodeType === 'episode' && episodeNumber
        ? `Episode ${episodeNumber}`
        : episodeType === 'standalone'
          ? 'Film'
          : seasonNumber ? `Staffel ${seasonNumber}` : '';
    const canonicalPrefix = unit
      ? `Das Ende von ${seriesTitleEN} ${unit} erklärt:`
      : `Das Ende von ${seriesTitleEN} erklärt:`;
    // Try to extract a concise suffix (8–10 words) from the LLM headline.
    const cleaned = headline.replace(/^[^:]+:\s*/, '').trim();
    const shortSuffix = cleaned.split(/\s+/).slice(0, 10).join(' ');
    return shortSuffix ? `${canonicalPrefix} ${shortSuffix}` : canonicalPrefix;
  }
  const originalHeadline = result.newHeadline;
  result.newHeadline = enforceEndeErklaertFormat(
    result.newHeadline,
    result.seriesTitleEN,
    result.episodeType,
    result.seasonNumber,
    result.episodeNumber,
  );
  if (originalHeadline !== result.newHeadline) {
    console.log(`⚙️  Headline-Format korrigiert:`);
    console.log(`   alt:  "${originalHeadline}"`);
    console.log(`   neu:  "${result.newHeadline}"\n`);
  }

  // Find series in DB
  const seriesTitle = result.seriesTitleEN || '';
  const dbSeries = await prisma.series.findFirst({
    where: { OR: [
      { name: { equals: seriesTitle, mode: 'insensitive' } },
      { title: { equals: seriesTitle, mode: 'insensitive' } },
      { originalName: { equals: seriesTitle, mode: 'insensitive' } },
    ]},
    select: { tmdbId: true, title: true, slug: true, posterLocalUrl: true, backdropLocalUrl: true },
  });
  console.log(`📺 DB-Match: ${dbSeries ? `${dbSeries.title} (tmdbId=${dbSeries.tmdbId})` : 'nicht gefunden — Draft ohne Serie'}\n`);

  // Build final article with attribution footer
  const attribution = `<hr/><p><em>Hinweis: Dieser Artikel basiert auf Informationen von <a href="${url}" rel="nofollow noopener" target="_blank">The Cinemaholic</a>. Die Textfassung ist eine eigenständige deutsche Redaktionsleistung von serien.de.</em></p>`;
  const faqHtml = `<h2>Häufige Fragen</h2>` + result.faq.map(f => `<h3>${f.q}</h3><p>${f.a}</p>`).join('');
  const keyFactsHtml = `<h2>Das Wichtigste auf einen Blick</h2><ul>` + result.key_facts.map(k => `<li>${k}</li>`).join('') + `</ul>`;
  const fullHtml = keyFactsHtml + result.body_html + faqHtml + attribution;

  // Save as DRAFT
  const slug = slugify(result.newHeadline);
  const article = await prisma.articles.create({
    data: {
      id: `demo-ende-erklaert-${Date.now()}`,
      title: result.newHeadline,
      slug,
      excerpt: result.teaser,
      contentHtml: fullHtml,
      contentType: 'SINGLE_SERIES_NEWS',
      status: 'draft',              // <-- not published, just preview
      primarySeriesId: dbSeries?.tmdbId ?? null,
      authorId: 'author-julia',
      updatedAt: new Date(),
      sourceUrl: url,
    },
  });

  console.log('━'.repeat(70));
  console.log('✓ ARTICLE CREATED AS DRAFT');
  console.log('━'.repeat(70));
  console.log('ID         :', article.id);
  console.log('Slug       :', article.slug);
  console.log('Headline   :', result.newHeadline);
  console.log('Teaser     :', result.teaser);
  console.log('Series     :', dbSeries?.title || '—');
  console.log('Source     :', url);
  console.log('Wörter     :', result.body_html.split(/\s+/).length);
  console.log('FAQs       :', result.faq.length);
  console.log('Key facts  :', result.key_facts.length);
  console.log();
  console.log('KEY FACTS:');
  result.key_facts.forEach((k, i) => console.log(` ${i+1}. ${k}`));
  console.log();
  console.log('TEASER (HTML Preview Save):');
  console.log('/tmp/ende-erklaert-preview.html');

  const preview = `<!doctype html><html><head><meta charset="utf-8"><title>${result.newHeadline}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1a202c;line-height:1.6}
h1{font-size:34px;line-height:1.2;margin:0 0 12px}
.teaser{color:#64748b;font-style:italic;font-size:18px;margin-bottom:30px}
.meta{color:#94a3b8;font-size:13px;margin-bottom:24px;border-top:2px solid #13bfe0;border-bottom:1px solid #e2e8f0;padding:10px 0}
h2{font-size:24px;margin-top:36px;color:#062344}h3{font-size:18px;color:#062344}
ul{padding-left:20px}li{margin:6px 0}
p{margin:14px 0}
a{color:#13bfe0}
hr{border:none;border-top:1px solid #e2e8f0;margin:32px 0 12px}
</style></head><body>
<div class="meta">SERIEN.DE · ${dbSeries?.title || 'Serien-News'} · DRAFT · ${new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' })}</div>
<h1>${result.newHeadline}</h1>
<div class="teaser">${result.teaser}</div>
${fullHtml}
</body></html>`;
  const fs = await import('node:fs/promises');
  await fs.writeFile('/tmp/ende-erklaert-preview.html', preview);

  await prisma.$disconnect();
}

main(process.argv[2]).catch(e => { console.error(e); process.exit(1); });
