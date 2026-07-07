import type { MetadataRoute } from "next";
import { isPreviewDeployment } from "@/lib/seo/site";

const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  if (isPreviewDeployment()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: "/" as const,
      })),
    ],
  };
}
