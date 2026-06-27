/**
 * Helper to inject arbitrary HTML (potentially containing <script> tags)
 * into a container element while ensuring scripts actually execute.
 *
 * Browsers do NOT execute <script> tags that are inserted via innerHTML —
 * we have to manually create new script elements and append them. This is
 * the standard workaround used by every ad SDK that supports raw HTML
 * (DFP/GPT, Plista, Outbrain, Taboola, custom direct-deal creatives).
 *
 * Trust note: the HTML comes from an admin-only DB field, controlled by the
 * site operator. We deliberately allow scripts. This is not user-generated
 * content.
 */
export function injectHtmlWithScripts(container: HTMLElement, html: string): void {
  // Wipe previous content
  container.innerHTML = '';

  // Parse into a detached document fragment so scripts inside are inert
  // until we explicitly re-create them.
  const template = document.createElement('template');
  template.innerHTML = html;

  // Append everything EXCEPT scripts first, so they have a parent to bind to.
  const scripts: HTMLScriptElement[] = [];
  template.content.querySelectorAll('script').forEach((s) => {
    scripts.push(s as HTMLScriptElement);
    s.remove();
  });
  container.appendChild(template.content);

  // Re-create each script. Setting src triggers an async fetch; inline
  // scripts execute synchronously when appended.
  for (const oldScript of scripts) {
    const newScript = document.createElement('script');
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value);
    }
    if (oldScript.textContent) newScript.textContent = oldScript.textContent;
    container.appendChild(newScript);
  }
}

export interface AdVariant {
  label?: string;
  html: string;
  weight?: number;
  isActive?: boolean;
}

/**
 * Pick a variant from a list based on rotation mode.
 *   - 'first':    deterministic, always the first active variant
 *   - 'random':   uniform random over active variants (weight ignored)
 *   - 'weighted': probability proportional to `weight` (default weight 1)
 *
 * Returns null when no active variant is available.
 */
export function pickAdVariant(
  variants: AdVariant[],
  mode: 'random' | 'weighted' | 'first' = 'random',
): AdVariant | null {
  const active = variants.filter((v) => v.isActive !== false && v.html?.trim());
  if (active.length === 0) return null;
  if (active.length === 1 || mode === 'first') return active[0];

  if (mode === 'weighted') {
    const total = active.reduce((s, v) => s + Math.max(0, v.weight ?? 1), 0);
    if (total <= 0) return active[0];
    let r = Math.random() * total;
    for (const v of active) {
      r -= Math.max(0, v.weight ?? 1);
      if (r <= 0) return v;
    }
    return active[active.length - 1];
  }

  // random (uniform)
  return active[Math.floor(Math.random() * active.length)];
}

/**
 * Render arbitrary 3rd-party ad HTML inside a sandboxed iframe (via srcdoc).
 *
 * Why iframes?  Many affiliate/ad networks (AWIN, Belboon, Tradedoubler,
 * Plista, Outbrain, banner exchanges, etc.) use `document.write()` inside
 * their external `<script src=...>`-snippets. After the host document has
 * finished loading, `document.write()` either does nothing or wipes the
 * whole page — modern browsers actively block it post-load. An iframe gives
 * the snippet its own document context, in which `document.write()` works
 * exactly like the network expects.
 *
 * Trust note: srcdoc is rendered same-origin by default; we add
 * `sandbox="allow-scripts allow-popups allow-same-origin"` so the iframe
 * cannot navigate the parent but its scripts run. The HTML comes from an
 * admin-only DB field — not user content.
 */
export function renderAdInIframe(
  container: HTMLElement,
  html: string,
  width: number,
  height: number,
): void {
  container.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('loading', 'lazy');
  iframe.style.cssText = `display:block;width:${width}px;height:${height}px;border:0;margin:0;padding:0;overflow:hidden;`;
  // Wrap the snippet in a minimal HTML document so external scripts have a
  // body to write into. CSS-Hardening innerhalb des iframes:
  //   - `img, a, table { max-width:100% !important }` zwingt Affiliate-
  //     Creatives (AWIN, Belboon, Amazon-Style), sich der iframe-Breite
  //     anzupassen, statt rechts überzulaufen.
  //   - `body { overflow:hidden }` killt horizontale Scrollbars.
  //   - `<base target="_blank">` öffnet Affiliate-Klicks im neuen Tab,
  //     damit der User die Hauptseite nicht verlässt.
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${width}"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:${width}px;}img,iframe,video,embed,object{max-width:100%!important;height:auto!important;}a{display:inline-block;max-width:100%;border:0;text-decoration:none;}a img{display:block;}table{max-width:100%!important;}</style></head><body>${html}</body></html>`;
  container.appendChild(iframe);
}

