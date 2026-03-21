'use client';

import { Newspaper, Sparkles } from 'lucide-react';

interface FeedSwitcherProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isLoggedIn?: boolean;
}

export default function FeedSwitcher({ activeTab, onTabChange, isLoggedIn }: FeedSwitcherProps) {
  const tabs = ['all-news', 'my-news'];

  const tabConfig: Record<string, { label: string; icon: any; gradient: string }> = {
    'my-news': {
      label: 'Mein Feed',
      icon: Sparkles,
      gradient: 'from-violet-600 via-purple-600 to-pink-600'
    },
    'all-news': {
      label: 'Serien News',
      icon: Newspaper,
      gradient: 'from-cyan-500 via-cyan-600 to-teal-600'
    }
  };

  return (
    <div className="mb-8 flex justify-center">
      <div className="inline-flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-800 rounded-full">
        {tabs.map((tab) => {
          const config = tabConfig[tab];
          const Icon = config.icon;
          const isActive = activeTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`
                relative px-5 py-3 rounded-full font-medium text-sm
                transition-all duration-300 ease-out
                flex items-center gap-2
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}