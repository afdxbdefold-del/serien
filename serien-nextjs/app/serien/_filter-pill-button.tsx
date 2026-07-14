'use client';

/**
 * Serienfinder-Filter — Client-side Filter-Pill (Feb 2026 SEO-Fix).
 *
 * Wichtig: Diese Component ist ein <button>, KEIN <a href>. Damit erzeugen
 * kombinierte Filter-URLs KEINE crawlbaren Links, die Google indexieren
 * könnte. User-Klick löst clientseitiges router.push() aus (History-safe,
 * Back-/Forward-Navigation funktioniert weiterhin).
 *
 * Clean Landing-Page-Links (z.B. /serien → /serien/genre/drama) laufen
 * bewusst weiterhin als <Link> in _overview.tsx (SEO-Discovery), aber
 * jede Filter-Kombination wird hier zum Button.
 */
import { useRouter } from 'next/navigation';
import type { KeyboardEvent } from 'react';

interface Props {
  href: string;
  active: boolean;
  testid?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

export default function FilterPillButton({ href, active, testid, children, ariaLabel }: Props) {
  const router = useRouter();

  const activate = () => {
    router.push(href, { scroll: false });
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Space/Enter aktiviert bereits standardmäßig — kein Extra-Handler nötig.
    // Wir belassen aria-Rolle als button (native).
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      activate();
    }
  };

  return (
    <button
      type="button"
      onClick={activate}
      onKeyDown={onKey}
      aria-pressed={active}
      aria-label={ariaLabel}
      data-testid={testid}
      className={`px-2.5 py-1 rounded-full border text-xs transition-all cursor-pointer ${
        active
          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-500 font-semibold'
          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}
