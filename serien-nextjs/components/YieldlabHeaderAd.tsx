'use client';

/**
 * Yieldlab 300x250 ad slot rendered immediately below the site header.
 *
 *   <!-- Serien.de - 300x250 #ylid18384401# (id 18384401) -->
 *   <script src="https://ad.yieldlab.net/d/18384401/35673/?ts=[zeitstempel]"></script>
 *
 * Notes:
 *   - The Yieldlab tag is injected client-side via `useEffect` so the
 *     [zeitstempel] cache-buster is unique per page-view (otherwise an ISR
 *     cached HTML would serve the same `ts` to every visitor).
 *   - The container has a fixed 300×250 frame to prevent CLS while the
 *     creative is loading.
 *   - We render the ad only after the GateKeeper CMP consent state is
 *     known (TCF2 `__tcfapi`) — if no CMP signal arrives within 1500 ms,
 *     we still render so reach isn't broken on stale CMPs.
 */

import { useEffect, useRef, useState } from 'react';

export default function YieldlabHeaderAd() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    // Wait for TCF2 consent signal — fallback after 1.5s.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const tcfApi = (window as unknown as { __tcfapi?: (cmd: string, ver: number, cb: (data: unknown, success: boolean) => void) => void }).__tcfapi;

    if (typeof tcfApi === 'function') {
      const onCmp = (data: unknown, success: boolean) => {
        if (success) setCanRender(true);
      };
      try { tcfApi('addEventListener', 2, onCmp); } catch { /* noop */ }
      timeout = setTimeout(() => setCanRender(true), 1500);
    } else {
      // No CMP detected (e.g. dev/local). Render immediately.
      setCanRender(true);
    }
    return () => { if (timeout) clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!canRender || !slotRef.current) return;
    if (slotRef.current.childElementCount > 0) return; // already injected

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://ad.yieldlab.net/d/18384401/35673/?ts=${Date.now()}`;
    script.async = true;
    slotRef.current.appendChild(script);
  }, [canRender]);

  return (
    <aside
      className="w-full flex justify-center bg-[#f4f6f9] dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800/60 py-3"
      aria-label="Werbung"
      data-testid="yieldlab-header-ad"
    >
      <div
        ref={slotRef}
        className="w-[300px] h-[250px] flex items-center justify-center text-[10px] uppercase tracking-widest text-slate-400"
      >
        {/* Yieldlab creative is injected here. Placeholder shows nothing once the
            script renders an iframe / image inside the container. */}
        <span aria-hidden="true">Anzeige</span>
      </div>
    </aside>
  );
}
