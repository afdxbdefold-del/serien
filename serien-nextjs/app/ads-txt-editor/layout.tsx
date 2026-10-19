import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ads.txt-Editor | serien.de',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function AdsEditorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
