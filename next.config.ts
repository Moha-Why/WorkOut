import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Images from external sources (YouTube thumbnails, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'vumbnail.com',
      },
    ],
  },
};

export default nextConfig;
