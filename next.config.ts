import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pg"],
  devIndicators: false,
};

export default nextConfig;
