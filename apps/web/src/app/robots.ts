import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/thumbnail/", "/sitemap.xml", "/sitemaps/"],
        disallow: [
          "/api/",
          "/profile",
          "/profile/",
          "/devices",
          "/devices/",
          "/payment",
          "/payment/",
          "/search",
          "/login",
          "/register",
          "/*?redirect=",
        ],
      },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
      { userAgent: "Amazonbot", disallow: "/" },
      { userAgent: "FacebookBot", disallow: "/" },
      { userAgent: "Omgilibot", disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
