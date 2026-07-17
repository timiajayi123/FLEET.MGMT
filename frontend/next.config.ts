import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${process.env.BACKEND_URL ?? 'http://localhost:3002'}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
