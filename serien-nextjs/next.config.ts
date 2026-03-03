import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { 
        protocol: 'https', 
        hostname: 'images.unsplash.com' 
      },
      { 
        protocol: 'https', 
        hostname: 'images.pexels.com' 
      },
      { 
        protocol: 'https', 
        hostname: '**.vercel-storage.com' 
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
    ]
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma']
  }
};

export default nextConfig;
