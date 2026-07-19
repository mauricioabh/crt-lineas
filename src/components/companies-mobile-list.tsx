"use client";

import { ChevronRight, CircleAlert, Loader2 } from "lucide-react";

import {
  canVerifyLinkRow,
  type CompanyLinkRow,
} from "@/components/company-link-row";
import {
  AutoStatusChip,
  LinesStatusBadge,
  ReviewedBadge,
} from "@/components/status-badge";
import { cn } from "@/lib/utils";

/**
 * Lista compacta de enlaces para viewports `< md`. Cada fila abre el sheet de
 * detalle donde vive la acción «Verificar» individual.
 */
export function CompaniesMobileList({
  rows,
  pendingCheckLinkId,
  onOpenDetail,
}: {
  rows: CompanyLinkRow[];
  /** linkId con verificación en curso (individual o masiva) para mostrar spinner. */
  pendingCheckLinkId: string | null;
  onOpenDetail: (linkId: string) => void;
}) {
  return (
    <ul
      className="divide-y divide-border overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Enlaces de compañías"
    >
      {rows.map((r) => {
        const checking = pendingCheckLinkId === r.linkId;
        const hasError =
          r.lastMonitorErrorMessage != null &&
          r.lastMonitorErrorMessage.trim() !== "";
        return (
          <li key={r.linkId}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
              onClick={() => {
                onOpenDetail(r.linkId);
              }}
              aria-label={`Ver detalle de ${r.companyName}`}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
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
              </div>
              {checking ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin text-muted-foreground"
                  aria-label="Verificación en curso"
                />
              ) : (
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground/60",
                    canVerifyLinkRow(r) && "text-muted-foreground",
                  )}
                  aria-hidden
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
