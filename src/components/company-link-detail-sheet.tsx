"use client";

import { CircleAlert, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import {
  canVerifyLinkRow,
  verifyDisabledReason,
  type CompanyLinkRow,
} from "@/components/company-link-row";
import {
  AutoStatusChip,
  LinesStatusBadge,
  ManualBadge,
  ReviewedBadge,
} from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { sanitizeEnvFromUserFacingText } from "@/lib/monitor-error-format";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {
      // Sin store externo; el snapshot es fijo por entorno.
    },
    () => true,
    () => false,
  );
}

function formatReviewedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Sheet inferior (móvil) con el detalle de un enlace y la acción primaria
 * «Verificar», que reutiliza el mismo flujo individual de la tabla desktop.
 */
export function CompanyLinkDetailSheet({
  row,
  open,
  onOpenChange,
  verifying,
  actionsDisabled,
  onVerify,
  onAdjustLines,
}: {
  row: CompanyLinkRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La verificación de este enlace está en curso. */
  verifying: boolean;
  /** Bloquea acciones mientras corre otra verificación (individual o masiva). */
  actionsDisabled: boolean;
  onVerify: (row: CompanyLinkRow) => void;
  onAdjustLines: (linkId: string, hasActiveLines: boolean | null) => void;
}) {
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

  if (!isClient || !open || !row) {
    return null;
  }

  const canVerify = canVerifyLinkRow(row);
  const disabledReason = verifyDisabledReason(row);
  const errorMessage = row.lastMonitorErrorMessage
    ? sanitizeEnvFromUserFacingText(row.lastMonitorErrorMessage)
    : null;
  const errorDetail = row.lastMonitorErrorDetail
    ? sanitizeEnvFromUserFacingText(row.lastMonitorErrorDetail)
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-black/50 md:items-center"
      role="presentation"
      onClick={() => {
        onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-detail-title"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl md:rounded-2xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted md:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2
            id="link-detail-title"
            className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground"
          >
            {row.companyName}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0"
            aria-label="Cerrar detalle"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AutoStatusChip status={row.verificationStatus} />
          <LinesStatusBadge hasActiveLines={row.hasActiveLines} />
          <ReviewedBadge reviewed={row.isReviewed} />
          <ManualBadge manual={row.isManualReview} />
          {!row.enabled ? (
            <span className="inline-flex h-5 items-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Deshabilitada
            </span>
          ) : null}
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sitio de verificación
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
                title={row.url}
              >
                {row.url}
              </a>
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir en nueva pestaña: ${row.url}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "icon",
                  className: "size-8 shrink-0",
                })}
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Última revisión
            </dt>
            <dd className="mt-1 tabular-nums text-foreground">
              <span suppressHydrationWarning>
                {row.lastReviewedAt
                  ? formatReviewedAt(row.lastReviewedAt)
                  : "Sin revisiones registradas"}
              </span>
            </dd>
          </div>
          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-destructive">
                <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                Error de la última verificación
              </dt>
              <dd className="mt-1 text-sm leading-snug text-foreground">
                {errorMessage}
              </dd>
              {errorDetail && errorDetail.trim() !== "" ? (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Detalle técnico (para soporte)
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[11px] text-muted-foreground">
                    {errorDetail}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </dl>

        <div className="mt-4 border-t border-border pt-4">
          <label
            htmlFor="mobile-adjust-lines"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Ajuste manual de líneas
          </label>
          <select
            id="mobile-adjust-lines"
            disabled={actionsDisabled}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm dark:bg-zinc-950"
            value={
              row.hasActiveLines === null
                ? "unknown"
                : row.hasActiveLines
                  ? "yes"
                  : "no"
            }
            onChange={(e) => {
              const v = e.target.value;
              onAdjustLines(
                row.linkId,
                v === "unknown" ? null : v === "yes" ? true : false,
              );
            }}
          >
            <option value="unknown">Desconocido</option>
            <option value="yes">Con líneas</option>
            <option value="no">Sin líneas</option>
          </select>
        </div>

        <div className="mt-4 space-y-2">
          <Button
            type="button"
            className="h-11 w-full text-sm font-semibold"
            disabled={!canVerify || verifying || actionsDisabled}
            onClick={() => {
              onVerify(row);
            }}
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Verificando…
              </>
            ) : (
              "Verificar"
            )}
          </Button>
          {disabledReason !== null ? (
            <p className="text-xs leading-snug text-muted-foreground">
              {disabledReason}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
