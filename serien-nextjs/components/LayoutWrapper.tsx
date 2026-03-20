'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import { ThemeProvider } from './ThemeProvider';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  // Admin routes have their own full-page layout
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Public routes get the standard header/footer
  return (
    <ThemeProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </ThemeProvider>
  );
}
