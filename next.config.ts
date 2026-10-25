import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Dev server is also reached through the public domain/reverse proxy, so
  // Next must allow it for HMR and dev-only resources. Ignored in production.
  allowedDevOrigins: ["repo.nourose.com", "192.168.1.111"],
};

export default nextConfig;
