'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if admin is logged in
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
      router.push('/admin/login');
    } else {
      router.push('/admin/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        <p className="mt-4 text-gray-600">Weiterleitung...</p>
      </div>
    </div>
  );
}
