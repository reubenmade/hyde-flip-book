import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Don't let the client Router Cache serve stale admin/activity data —
    // always refetch dynamic pages on navigation so new opens show up instantly.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
