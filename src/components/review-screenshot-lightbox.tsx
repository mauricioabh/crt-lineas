"use client";

import { X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {
      // No external store; snapshot is fixed per environment.
    },
    () => true,
    () => false,
  );
}

type Props = {
  linkId: string | null;
  /** Invalida caché del navegador cuando cambia la fecha ISO de la captura en servidor. */
  cacheKey?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReviewScreenshotLightbox({
  linkId,
  cacheKey,
  open,
  onOpenChange,
}: Props) {
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!isClient || !open || !linkId) {
    return null;
  }

  const qs =
    cacheKey != null && cacheKey !== ""
      ? `?v=${encodeURIComponent(cacheKey)}`
      : "";
  const src = `/api/company-links/${linkId}/screenshot${qs}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
      role="presentation"
      onClick={() => {
        onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Captura de verificación"
        className="relative my-auto max-h-[min(92vh,calc(100dvh-2rem))] max-w-[min(96vw,1200px)] rounded-lg border border-zinc-700 bg-zinc-950 p-2 pt-12 shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute right-2 top-2 z-10 gap-1 shadow-md"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          <X className="size-4" aria-hidden />
          Cerrar
        </Button>
        {/* eslint-disable-next-line @next/next/no-img-element -- API route needs cookie auth; next/image remotePatterns would not help */}
        <img
          src={src}
          alt="Captura de pantalla del resultado de la verificación"
          className="max-h-[min(85vh,calc(100dvh-5rem))] w-auto max-w-full rounded object-contain"
        />
      </div>
    </div>,
    document.body,
  );
}
