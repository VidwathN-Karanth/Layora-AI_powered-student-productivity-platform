import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGithubActions ? '/FrontendProject' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
