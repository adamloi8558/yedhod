import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: require("path").join(__dirname, "../../"),
  transpilePackages: [
    "@kodhom/ui",
    "@kodhom/db",
    "@kodhom/r2",
    "@kodhom/validators",
    "@kodhom/config",
  ],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
    ],
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
          },
          { key: "Vary", value: "Host" },
        ],
      },
      {
        source: "/category/:slug*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
          },
          { key: "Vary", value: "Host" },
        ],
      },
      {
        source: "/api/clips/:id/thumbnail",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
