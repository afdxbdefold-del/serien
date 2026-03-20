'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';

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
            theme === 'light' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Hell</span>
          {theme === 'light' && <span className="ml-auto text-blue-500">✓</span>}
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            theme === 'dark' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>Dunkel</span>
          {theme === 'dark' && <span className="ml-auto text-blue-500">✓</span>}
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            theme === 'system' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>System</span>
          {theme === 'system' && <span className="ml-auto text-blue-500">✓</span>}
        </button>
      </div>
    );
  }

  // Icon variant - cycles through themes
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={`Aktuelles Theme: ${theme}. Klicken zum Wechseln.`}
      title={`Theme: ${theme === 'system' ? 'System' : theme === 'dark' ? 'Dunkel' : 'Hell'}`}
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="w-5 h-5 text-gray-300" />
      ) : (
        <Sun className="w-5 h-5 text-gray-600" />
      )}
    </button>
  );
}
