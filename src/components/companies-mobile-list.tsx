"use client";

import { ChevronRight, CircleAlert, Loader2 } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  canVerifyLinkRow,
  verifyDisabledReason,
  type CompanyLinkRow,
} from "@/components/company-link-row";
import {
  AutoStatusChip,
  LinesStatusBadge,
  ReviewedBadge,
} from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

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
 * Lista compacta de enlaces para viewports `< md`.
 * Cada fila muestra nombre, badges, última revisión y «Verificar»;
 * el resto del detalle sigue en el sheet.
 */
export function CompaniesMobileList({
  rows,
  pendingCheckLinkId,
  actionsDisabled,
  onOpenDetail,
  onVerify,
}: {
  rows: CompanyLinkRow[];
  /** linkId con verificación en curso (individual o masiva) para mostrar spinner. */
  pendingCheckLinkId: string | null;
  /** Bloquea Verificar mientras corre otra verificación. */
  actionsDisabled: boolean;
  onOpenDetail: (linkId: string) => void;
  onVerify: (row: CompanyLinkRow) => void;
}) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  return (
    <ul
      className="divide-y divide-border overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Enlaces de compañías"
    >
      {rows.map((r) => {
        const checking = pendingCheckLinkId === r.linkId;
        const canVerify = canVerifyLinkRow(r);
        const disabledReason = verifyDisabledReason(r);
        const hasError =
          r.lastMonitorErrorMessage != null &&
          r.lastMonitorErrorMessage.trim() !== "";
        return (
          <li key={r.linkId}>
            <div className="flex items-stretch gap-2 px-3 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 space-y-1.5 text-left transition-colors"
                onClick={() => {
                  onOpenDetail(r.linkId);
                }}
                aria-label={`Ver detalle de ${r.companyName}`}
              >
                <p
                  className={cn(
                    "truncate text-sm font-medium text-foreground",
                    !r.enabled && "text-muted-foreground line-through",
                  )}
                >
                  {r.companyName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <AutoStatusChip status={r.verificationStatus} />
                  <LinesStatusBadge hasActiveLines={r.hasActiveLines} />
                  {r.isReviewed ? <ReviewedBadge reviewed /> : null}
                  {hasError ? (
                    <span
                      className="inline-flex h-5 items-center gap-1 rounded-full bg-destructive/10 px-1.5 text-[11px] font-medium leading-none text-destructive"
                      title="Última verificación automática con error"
                    >
                      <CircleAlert className="size-3 shrink-0" aria-hidden />
                      Error
                    </span>
                  ) : null}
                </div>
                <p
                  className="text-xs tabular-nums text-muted-foreground"
                  title={
                    mounted && r.lastReviewedAt
                      ? formatReviewedAt(r.lastReviewedAt)
                      : undefined
                  }
                >
                  {mounted && r.lastReviewedAt
                    ? `Última revisión: ${formatReviewedAt(r.lastReviewedAt)}`
                    : "Última revisión: —"}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={!canVerify || checking || actionsDisabled}
                  title={disabledReason ?? undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerify(r);
                  }}
                >
                  {checking ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Verificar"
                  )}
                </Button>
                <ChevronRight
                  className="size-4 text-muted-foreground/50"
                  aria-hidden
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
