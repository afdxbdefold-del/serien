'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';

export default function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    // Check if already subscribed or dismissed
    const dismissed = localStorage.getItem('push-prompt-dismissed');
    if (dismissed) return;

    // Check current subscription status
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        setIsSubscribed(true);
      } else {
        // Show prompt after 5 seconds
        setTimeout(() => setShowPrompt(true), 5000);
      }
    });

    // Register service worker
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }, []);

  const subscribe = async () => {
    setIsLoading(true);
    try {
      // Get VAPID public key
      const response = await fetch('/api/push/subscribe');
      const { publicKey } = await response.json();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });

      setIsSubscribed(true);
      setShowPrompt(false);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem('push-prompt-dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || isSubscribed) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-white dark:bg-[hsl(230,25%,9%)] rounded-2xl shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-[hsl(230,25%,15%)] p-5 z-50 animate-slide-up">
      <button 
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-5 h-5" />
      </button>
      
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-cyan-100 dark:bg-cyan-500/20 rounded-full flex items-center justify-center">
          <Bell className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
            Serien-News erhalten?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Wir benachrichtigen dich bei neuen Artikeln zu deinen Lieblingsserien.
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={subscribe}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Wird aktiviert...' : 'Aktivieren'}
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[hsl(230,25%,15%)] font-medium rounded-lg transition-colors"
            >
              Später
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
