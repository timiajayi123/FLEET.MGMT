import type { NextConfig } from 'next';

const rawBackendUrl = process.env.BACKEND_URL?.trim();
const backendUrl =
  rawBackendUrl && /^https?:\/\//i.test(rawBackendUrl)
    ? rawBackendUrl.replace(/\/+$/, '')
    : 'http://backend:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
