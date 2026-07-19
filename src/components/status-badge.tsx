import { Badge } from "@/components/ui/badge";
import type { LinkVerificationStatus } from "@/components/company-link-row";
import { cn } from "@/lib/utils";

type TriState = "yes" | "no" | "unknown";

function toTriState(value: boolean | null | undefined): TriState {
  if (value === true) {
    return "yes";
  }
  if (value === false) {
    return "no";
  }
  return "unknown";
}

const tableBadge =
  "h-5 min-h-5 shrink px-1.5 py-0 text-[11px] font-normal leading-none";

export function LinesStatusBadge({
  hasActiveLines,
  className,
}: {
  hasActiveLines: boolean | null;
  className?: string;
}) {
  const state = toTriState(hasActiveLines);
  switch (state) {
    case "yes":
      return (
        <Badge
          className={cn(
            "bg-emerald-600 hover:bg-emerald-600",
            tableBadge,
            className,
          )}
        >
          Con líneas
        </Badge>
      );
    case "no":
      return (
        <Badge className={cn(tableBadge, className)} variant="secondary">
          Sin líneas
        </Badge>
      );
    case "unknown":
      return (
        <Badge className={cn(tableBadge, className)} variant="outline">
          Desconocido
        </Badge>
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function ReviewedBadge({
  reviewed,
  className,
}: {
  reviewed: boolean;
  className?: string;
}) {
  return reviewed ? (
    <Badge
      className={cn("bg-blue-600 hover:bg-blue-600", tableBadge, className)}
    >
      Sí
    </Badge>
  ) : (
    <Badge className={cn(tableBadge, className)} variant="outline">
      No
    </Badge>
  );
}

/** Chip de estado «Auto» (verificación automatizada) compartido entre tabla desktop y vista móvil. */
export function AutoStatusChip({
  status,
  className,
}: {
  status: LinkVerificationStatus;
  className?: string;
}) {
  const base =
    "inline-flex h-5 items-center rounded-full px-1.5 text-[11px] font-medium leading-none";
  switch (status) {
    case "yes":
      return (
        <span
          className={cn(
            base,
            "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
            className,
          )}
          title="Hay verificación automatizada; «Verificar» consulta el portal"
        >
          Sí
        </span>
      );
    case "in-review":
      return (
        <span
          className={cn(
            base,
            "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
            className,
          )}
          title="Protocolo escrito, en revisión y pruebas"
        >
          En revisión
        </span>
      );
    case "pending":
      return (
        <span
          className={cn(
            base,
            "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
            className,
          )}
          title="El portal aún no cuenta con un flujo de verificación automatizable"
        >
          Pendiente
        </span>
      );
    case "no":
      return (
        <span
          className={cn(
            base,
            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
            className,
          )}
          title="Sin protocolo automatizado; use el ajuste manual de líneas"
        >
          No
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function ManualBadge({
  manual,
  className,
}: {
  manual: boolean;
  className?: string;
}) {
  return manual ? (
    <Badge className={cn(tableBadge, className)} variant="secondary">
      Manual
    </Badge>
  ) : (
    <Badge className={cn(tableBadge, className)} variant="outline">
      Auto
    </Badge>
  );
}
