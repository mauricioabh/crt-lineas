import { Badge } from "@/components/ui/badge";
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
