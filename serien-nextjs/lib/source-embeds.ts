/**
 * Build social-media embed blocks (Instagram, Twitter/X, YouTube) for
 * insertion into article HTML. Output is the raw embed HTML — the
 * frontend lazy-loads embed.js / widgets.js / iframe-resizer scripts
 * via the responsive `.embed-container` wrapper already handled in
 * lib/content-sanitizer.ts.
 *
 * Strategy: after content generation, the pipeline calls
 *   `injectSourceEmbeds(html, { instagramPermalinks, … })`
 * which inserts ONE primary embed directly after the first H2 section
 * (or before the last <p> if no H2 exists). One embed per article
 * keeps Discover-loading lean.
 */

export interface SourceEmbeds {
  instagramPermalinks?: string[];
  twitterStatusUrls?: string[];
  youtubeVideoIds?: string[];
}

function buildInstagramEmbed(permalink: string): string {
  // Standard Instagram blockquote markup. Their CDN embed.js will hydrate
  // it on the client. The wrapping <div class="embed-container"> is added
  // automatically by the content sanitizer (lib/content-sanitizer.ts).
  return `<blockquote class="instagram-media" data-instgrm-permalink="${permalink}/?utm_source=ig_embed" data-instgrm-version="14" style="background:#FFF;border:0;border-radius:3px;box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15);margin:1em auto;max-width:540px;padding:0;width:100%"></blockquote>
<script async src="//www.instagram.com/embed.js"></script>`;
}

function buildTwitterEmbed(url: string): string {
  return `<blockquote class="twitter-tweet" data-lang="de" data-dnt="true"><a href="${url}"></a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
}

function buildYoutubeLiteEmbed(videoId: string): string {
  // Lite-YouTube facade: click-to-play, no iframe until user interaction.
  // Lazy-thumb from i.ytimg.com.
  return `<div class="video-embed-wrapper youtube-lite" data-yt-id="${videoId}" style="position:relative;aspect-ratio:16/9;max-width:720px;margin:1em auto;">
  <a href="https://www.youtube.com/watch?v=${videoId}" rel="noopener" target="_blank" style="display:block;width:100%;height:100%;background:url('https://i.ytimg.com/vi/${videoId}/hqdefault.jpg') center/cover no-repeat;text-decoration:none;">
    <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:48px;background:rgba(0,0,0,0.7);border-radius:8px;display:flex;align-items:center;justify-content:center;">
      <span style="border-left:18px solid #fff;border-top:12px solid transparent;border-bottom:12px solid transparent;margin-left:4px;"></span>
    </span>
  </a>
</div>`;
}

/**
 * Insert the primary embed (preferring Instagram > Twitter > YouTube)
 * after the first H2 section. If no H2 exists, append before the last
 * </p>. Returns html unchanged when no embeds are available.
 */
export function injectSourceEmbeds(html: string, embeds: SourceEmbeds): string {
  if (!html) return html;
  const ig = embeds.instagramPermalinks?.[0];
  const tw = embeds.twitterStatusUrls?.[0];
  const yt = embeds.youtubeVideoIds?.[0];

  let block = '';
  if (ig) block = buildInstagramEmbed(ig);
  else if (tw) block = buildTwitterEmbed(tw);
  else if (yt) block = buildYoutubeLiteEmbed(yt);
  if (!block) return html;

  // Avoid double-embedding (e.g. if the sanitizer kept an embed from the
  // source body or a previous run already injected it).
  if (ig && html.includes(ig)) return html;
  if (tw && html.includes(tw)) return html;
  if (yt && new RegExp(`data-yt-id="${yt}"|youtube\\.com/(?:embed|watch\\?v=)${yt}`).test(html)) {
    return html;
  }

  // Insert after the FIRST </p> following the FIRST <h2>…</h2>.
  // Reason: the section under the first H2 usually announces the topic
  // (teaser drop, news event) — that's the natural spot for the source
  // embed.
  const h2EndMatch = /<\/h2>/i.exec(html);
  if (h2EndMatch) {
    // Find the first </p> after the first </h2>
    const after = html.slice(h2EndMatch.index);
    const pMatch = /<\/p>/i.exec(after);
    if (pMatch) {
      const insertAt = h2EndMatch.index + pMatch.index + pMatch[0].length;
      return html.slice(0, insertAt) + '\n' + block + '\n' + html.slice(insertAt);
    }
  }

  // No H2 found: insert before the last </p>
  const lastP = html.lastIndexOf('</p>');
  if (lastP > -1) {
    const after = html.indexOf('</p>', lastP) + 4;
    return html.slice(0, after) + '\n' + block + '\n' + html.slice(after);
  }

  // Fallback: append at end
  return html + '\n' + block;
}
