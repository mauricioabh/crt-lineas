import type { CompanyPattern, MonitorResult } from "../base-pattern";

/**
 * Uber Cel — protocolo en revisión.
 * El flujo exacto del portal está siendo investigado; por ahora devuelve revisión manual.
 * Actualizar `matchesUrl` y `run` cuando se confirme el portal de consulta.
 */
export const uberCelPattern: CompanyPattern = {
  id: "uber-cel",
  matches: (companyName: string) => /uber\s*cel/i.test(companyName),
  supportsAutomatedVerification: false,
  run: async (): Promise<MonitorResult> => ({
    hasActiveLines: null,
    notes:
      "Uber Cel: protocolo en revisión. Use ajuste manual hasta que el flujo del portal esté validado.",
    isManualReview: true,
  }),
};
