import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    if (!apiUrl) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
