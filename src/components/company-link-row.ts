/**
 * Fila aplanada compañía+enlace que comparten la tabla desktop y la vista
 * móvil (lista + sheet de detalle). Mantener el union literal local para no
 * arrastrar `@/monitoring` (y Playwright) al bundle de cliente.
 */
export type LinkVerificationStatus = "yes" | "in-review" | "pending" | "no";

export type CompanyLinkRow = {
  num: number;
  companyId: string;
  companyName: string;
  enabled: boolean;
  linkId: string;
  url: string;
  verificationStatus: LinkVerificationStatus;
  hasActiveLines: boolean | null;
  isReviewed: boolean;
  isManualReview: boolean;
  lastReviewedAt: string | null;
  reviewScreenshotAt: string | null;
  lastMonitorErrorAt: string | null;
  lastMonitorErrorMessage: string | null;
  lastMonitorErrorDetail: string | null;
};

export function canVerifyLinkRow(row: CompanyLinkRow): boolean {
  return row.enabled && row.verificationStatus === "yes";
}

/** Motivo por el que «Verificar» está deshabilitado; `null` si es verificable. */
export function verifyDisabledReason(row: CompanyLinkRow): string | null {
  if (!row.enabled) {
    return "Compañía deshabilitada para usuarios.";
  }
  switch (row.verificationStatus) {
    case "yes":
      return null;
    case "in-review":
      return "Protocolo en revisión; aún no habilitado para ejecución automática. Ajuste el estado con el desplegable de líneas activas.";
    case "pending":
      return "El portal aún no cuenta con un flujo de verificación automatizable. Ajuste el estado con el desplegable de líneas activas.";
    case "no":
      return "Este portal no tiene protocolo de verificación automatizado. Ajuste el estado con el desplegable de líneas activas.";
    default: {
      const _exhaustive: never = row.verificationStatus;
      return _exhaustive;
    }
  }
}
