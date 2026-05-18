/**
 * Errores de ejecuci?n Playwright en verificaci?n: mensaje corto para UI y detalle para consola / modal.
 */

const ENV_VAR_NAME_RE =
  /\b(?:MONITOR_(?!RUN_FAILED)[A-Z0-9_]+|PLAYWRIGHT_[A-Z0-9_]+|UPLOADTHING_[A-Z0-9_]+|DATABASE_URL|NEXT_PUBLIC_[A-Z0-9_]+|CLERK_[A-Z0-9_]+)\b/g;
const ENV_ASSIGNMENT_RE = /\b[A-Z][A-Z0-9_]*\s*=\s*[^\s,;)]+/g;

/** Quita nombres y asignaciones de variables de entorno de texto visible al usuario. */
export function sanitizeEnvFromUserFacingText(text: string): string {
  if (!text) return text;
  return text
    .replace(ENV_ASSIGNMENT_RE, "")
    .replace(ENV_VAR_NAME_RE, "la configuraci?n del servidor")
    .replace(/\.env\.local/gi, "la configuraci?n del servidor")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export class MonitorRunError extends Error {
  readonly code = "MONITOR_RUN_FAILED" as const;
  readonly technicalDetail: string;

  constructor(message: string, technicalDetail: string) {
    const user = sanitizeEnvFromUserFacingText(message);
    const technical = sanitizeEnvFromUserFacingText(technicalDetail);
    super(user);
    this.technicalDetail = technical;
    this.name = "MonitorRunError";
  }
}

function technicalFromUnknown(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Convierte fallos de Playwright u otros errores en mensaje legible (es-MX). */
export function formatMonitorRunError(err: unknown): {
  userMessage: string;
  technical: string;
} {
  if (err instanceof MonitorRunError) {
    return { userMessage: err.message, technical: err.technicalDetail };
  }

  const technical = sanitizeEnvFromUserFacingText(technicalFromUnknown(err));
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  let userMessage =
    "No se pudo completar la verificaci?n autom?tica. Intente de nuevo o revise el enlace en el CRT.";

  if (lower.includes("timeout") && lower.includes("exceeded")) {
    userMessage =
      "El portal tard? demasiado o no mostr? el formulario esperado. Compruebe que la URL sea la correcta, que el sitio est? disponible y que el flujo del operador no haya cambiado.";
  } else if (
    lower.includes("net::err") ||
    (lower.includes("navigation") && lower.includes("failed"))
  ) {
    userMessage = "No se pudo abrir el portal (fallo de red o de navegaci?n).";
  } else if (
    lower.includes("target page, context or browser has been closed")
  ) {
    userMessage =
      "La sesi?n del navegador se cerr? antes de terminar. Intente de nuevo.";
  } else if (lower.includes("strict mode violation")) {
    userMessage =
      "Hay varios elementos en la p?gina que coinciden con lo que el robot esperaba. Hace falta ajustar el protocolo de verificaci?n.";
  } else if (
    lower.includes("no_automated") ||
    msg.includes("protocolo de verificaci?n automatizado")
  ) {
    userMessage = msg;
  }

  return {
    userMessage: sanitizeEnvFromUserFacingText(userMessage),
    technical,
  };
}

export function formatUnknownMonitorError(err: unknown): {
  userMessage: string;
  technical: string;
} {
  return formatMonitorRunError(err);
}
