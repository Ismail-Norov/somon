import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // The browser talks to the API through this origin, so the auth cookie stays first-party
  // no matter where the site is hosted.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
