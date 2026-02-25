import './globals.css';
export const metadata = {
  title: { default: 'serien.de | Serien-News & Updates', template: '%s | serien.de' },
  description: 'Aktuelle Serien-News',
  metadataBase: new URL('https://serien.de'),
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="de"><body>{children}</body></html>;
}
