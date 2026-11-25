import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const salesApiUrl = (
      process.env.NEXT_PUBLIC_SALES_API_URL || "https://computererp.onrender.com"
    ).replace(/\/$/, "");

    return [{ source: "/sales-api/:path*", destination: `${salesApiUrl}/:path*` }];
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
