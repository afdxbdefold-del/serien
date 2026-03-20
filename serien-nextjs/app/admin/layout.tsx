export const metadata = {
  title: 'Admin Panel | serien.de',
  description: 'Administrations-Bereich von serien.de',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin pages bypass the main layout header/footer
  // They render their own full-page layouts
  return <>{children}</>;
}
