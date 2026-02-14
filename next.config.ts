import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/join", destination: "/", permanent: false }, // 302, query params preserved
    ];
  },
};

export default nextConfig;
