import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Vercel: standalone output produces a self-contained .next/standalone dir
  // that Vercel can deploy without needing node_modules at runtime.
  output: "standalone",
  // Allow cross-origin requests from Vercel preview URLs
  allowedDevOrigins: ["*.vercel.app", "*.railway.app"],
  // External packages that shouldn't be bundled (Prisma, sharp, etc.)
  serverExternalPackages: ["@prisma/client", "sharp"],
};

export default nextConfig;
