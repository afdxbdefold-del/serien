'use client';

import { useMemo } from 'react';

interface ContentWithAdsProps {
  html: string;
  className?: string;
}

/**
 * Rendert reinen Artikel-Content — OHNE zwischenreingezogene In-Content-Ads.
 *
 * Historie: früher fetchte diese Component den DB-Slot `in_content` und
 * injizierte alle 4 Absätze eine TMN-Ad-Variante. Auf User-Direktive
 * (Feb 2026) komplett entfernt: keine In-Text-Ads mehr im Artikel-Content.
 *
 * Der Component-Name bleibt für Kompatibilität mit bestehenden Imports.
 * Die Route-aware Ad-Injection wurde ersatzlos gestrichen.
 */
export default function ContentWithAds({ html, className = '' }: ContentWithAdsProps) {
  // useMemo hier nur um Re-Renders zu minimieren wenn Parent häufig
  // rendert — html ist eine Prop und ändert sich pro Artikel-Slug.
  const safeHtml = useMemo(() => html, [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
