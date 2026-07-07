import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export function rootLayoutMetadata(): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    title: "CRT Líneas — Monitoreo",
    description:
      "Monitoreo de plataformas de compañías telefónicas (CRT México)",
    robots: { index: false, follow: false },
  };
}
