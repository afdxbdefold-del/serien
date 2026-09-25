'use client';

import { useEffect, useRef } from 'react';
import DesktopOnlyAds from './DesktopOnlyAds';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';
import type { GlobalTag, Placement } from '@/lib/global-tags';

function Tag({ tag, placement }: { tag: GlobalTag; placement: Placement }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    injectHtmlWithScripts(container, tag.html);
    return () => { container.innerHTML = ''; };
  }, [tag.html]);
  return <div ref={ref} data-global-tag={tag.name} data-placement={placement} />;
}

/** Raw DB tags must never be browser-active HTML in the server response. */
export default function DesktopGlobalTags({ tags, placement }: { tags: GlobalTag[]; placement: Placement }) {
  return (
    <DesktopOnlyAds>
      {tags.map((tag) => <Tag key={tag.id} tag={tag} placement={placement} />)}
    </DesktopOnlyAds>
  );
}
