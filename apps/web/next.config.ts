import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: require("path").join(__dirname, "../../"),
  transpilePackages: ["@kodhom/ui", "@kodhom/auth", "@kodhom/db", "@kodhom/r2", "@kodhom/validators"],
};

export default nextConfig;
