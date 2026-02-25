'use client';

import { useState } from 'react';

interface FeedSwitcherProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function FeedSwitcher({ activeTab, onTabChange }: FeedSwitcherProps) {
  const tabs = [
    { id: 'all-news', label: 'News', icon: '📰' },
    { id: 'my-feed', label: 'Mein Feed', icon: '⭐' },
    { id: 'series', label: 'Serien', icon: '📺' },
  ];

  return (
    <div className="flex gap-4 border-b border-border mb-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 py-3 px-4 border-b-2 transition-all font-medium
            ${activeTab === tab.id 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}