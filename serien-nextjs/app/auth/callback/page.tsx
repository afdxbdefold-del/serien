'use client';

import { useEffect, useRef } from 'use';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    
    // Prevent double execution in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1)); // Remove the #
        const sessionId = params.get('session_id');

        if (!sessionId) {
          console.error('No session_id found in URL');
          router.push('/');
          return;
        }

        // Exchange session_id for JWT token via backend
        const response = await fetch('/api/auth/google-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Important for cookies
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
          console.error('OAuth callback failed');
          router.push('/');
          return;
        }

        // Clear the hash from URL and redirect to home
        window.location.href = '/';
      } catch (error) {
        console.error('Auth processing error:', error);
        router.push('/');
      }
    };

    processAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Anmeldung wird verarbeitet...
        </h2>
        <p className="text-gray-600">
          Bitte warten Sie einen Moment.
        </p>
      </div>
    </div>
  );
}
