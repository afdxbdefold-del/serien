import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.tmdb.org' },
      { protocol: 'https', hostname: '**.vercel-storage.com' }
    ]
  }
};
export default nextConfig;
