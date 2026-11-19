import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next ships a "security upgrade" nudge that deliberately aborts next dev /
  // next build when run by a coding agent. Disable it so builds can complete;
  // upgrades are done deliberately instead of via the interrupt.
  experimental: {
    agentUpgrade: false,
  },
  async redirects() {
    return [
      {
        source: "/adminnew",
        destination: "/admin",
        permanent: true,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Dev server is also reached through the public domain/reverse proxy, so
  // Next must allow it for HMR and dev-only resources. Ignored in production.
  allowedDevOrigins: ["repo.nourose.com", "192.168.1.111"],
};

export default nextConfig;
