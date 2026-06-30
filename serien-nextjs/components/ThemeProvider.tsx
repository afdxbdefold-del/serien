'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';

// Dark-only Theme-Provider (User-Wunsch: kein Light-Mode mehr).
// API-Surface bleibt kompatibel mit altem useTheme()-Consumern, gibt
// aber immer `dark` zurück. ThemeToggle ist deaktiviert/entfernt.
type Theme = 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark';
  setTheme: (_: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_CONTEXT: ThemeContextType = {
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Belt-and-suspenders: layout.tsx setzt `class="dark"` schon auf <html>.
  // Falls irgendetwas (Browser-Extension, Stale-localStorage) das überschreibt,
  // erzwingen wir es hier nach Mount nochmal hart und säubern Legacy-Keys.
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('dark')) root.classList.add('dark');
    root.classList.remove('light');
    try {
      localStorage.removeItem('theme');
    } catch {
      /* localStorage kann in Private-Mode / Embedded-Browsern fehlen */
    }
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#1C1D22');
  }, []);

  return (
    <ThemeContext.Provider value={DARK_CONTEXT}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Außerhalb des Providers (z.B. in einem reinen Server-Component-Tree)
    // gibt es nichts zu togglen — wir liefern den Dark-Default statt zu
    // werfen, damit existierende Consumer nicht crashen.
    return DARK_CONTEXT;
  }
  return context;
}
