import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `playwright` sigue siendo importado por `/api/inngest` (cadena de funciones),
  // así que se mantiene como external para no bundlearlo. El navegador no corre
  // en Vercel (se ejecuta en el worker Hetzner); ya no se usa @sparticuz/chromium.
  serverExternalPackages: ["playwright", "playwright-core"],
};

const analyzedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
})(nextConfig);

export default withSentryConfig(analyzedConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "crt-lineas",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
