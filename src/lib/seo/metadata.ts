import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export function rootLayoutMetadata(): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    title: "CRT Líneas — Monitoreo",
    description:
      "Monitoreo de plataformas de compañías telefónicas (CRT México)",
    robots: { index: false, follow: false },
    appleWebApp: {
      capable: true,
      title: "CRT Líneas",
      statusBarStyle: "black-translucent",
    },
    icons: {
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

/** Viewport raíz: `themeColor` vive aquí (Next 16 lo separa de `metadata`). */
export function rootLayoutViewport(): Viewport {
  return {
    themeColor: "#18181b",
  };
}
