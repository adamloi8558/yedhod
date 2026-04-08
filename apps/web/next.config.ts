import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kodhom/ui", "@kodhom/auth", "@kodhom/db", "@kodhom/r2", "@kodhom/validators"],
};

export default nextConfig;
