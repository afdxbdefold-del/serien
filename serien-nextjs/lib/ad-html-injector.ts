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

