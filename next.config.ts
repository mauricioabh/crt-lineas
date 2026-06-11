import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@sparticuz/chromium",
  ],
  // Vercel: incluir binarios brotli de Chromium en las funciones de monitor/ingest.
  outputFileTracingIncludes: {
    "/api/monitor/[linkId]": ["./node_modules/@sparticuz/chromium/**"],
    "/api/monitor/bulk": ["./node_modules/@sparticuz/chromium/**"],
    "/api/ingest": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "crt-lineas",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
