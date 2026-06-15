import type { NextConfig } from "next";

// Test comment to trigger remote push and verify connections
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {

  trailingSlash: true,
  basePath: isGithubActions ? '/FrontendProject' : '',
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
