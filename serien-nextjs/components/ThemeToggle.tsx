'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'icon' | 'menu';
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (variant === 'menu') {
    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2">
          Design
        </div>
        <button
          onClick={() => setTheme('light')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            theme === 'light' || (theme === 'system' && resolvedTheme === 'light')
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Hell</span>
          {(theme === 'light' || (theme === 'system' && resolvedTheme === 'light')) && <span className="ml-auto text-blue-500">✓</span>}
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>Dunkel</span>
          {(theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')) && <span className="ml-auto text-blue-500">✓</span>}
        </button>
      </div>
    );
  }

  // Icon variant - toggles between light and dark
  const toggleTheme = () => {
    if (resolvedTheme === 'light') setTheme('dark');
    else setTheme('light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={`Aktuelles Theme: ${resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'}. Klicken zum Wechseln.`}
      title={`Theme: ${resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'}`}
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="w-5 h-5 text-gray-300" />
      ) : (
        <Sun className="w-5 h-5 text-gray-600" />
      )}
    </button>
  );
}
