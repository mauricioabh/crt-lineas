import type { Page } from "playwright";
import { normalizePhone10 } from "@/lib/verification-identity";
import type {
  CompanyPattern,
  MonitorRunContext,
  MonitorResult,
} from "../base-pattern";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeRedphoneBuscarUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (h !== "vinculacion.redphone.com.mx") return raw;
    const path = u.pathname.replace(/\/$/, "") || "/";
    if (path === "/" || path === "") {
      u.pathname = "/buscar";
      return u.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

/**
 * Portal Redphone — búsqueda por número de teléfono (10 dígitos desde `MONITOR_PHONE`).
 * URL CRT: `https://vinculacion.redphone.com.mx` o `…/buscar`.
 * Misma plataforma que Allce/Celfi/Mosi.
 */
export function matchesRedphoneBuscarVinculacionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "vinculacion.redphone.com.mx";
  } catch {
    return false;
  }
}

const NO_PENDING = /no encontramos ningún proceso de vinculación pendiente/i;
const SECURITY_FAILED = /verificaci[oó]n de seguridad fallida/i;
const POSITIVE_SIGNAL =
  /proceso de vinculaci[oó]n (?:encontrado|activo|disponible)|hay (?:un )?proceso pendiente|contin[uú]a (?:tu|con) (?:el )?proceso|l[ií]neas?\s+vinculadas|vinculaci[oó]n completada|paso\s*2/i;

export async function runRedphoneBuscarVinculacion(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "Redphone: falta el número de teléfono de prueba en el servidor (10 dígitos sin +52, ej. 5512345678) para rellenar «Número de Teléfono».",
      isManualReview: true,
    };
  }

  const visitUrl = normalizeRedphoneBuscarUrl(context.url);
  await page.goto(visitUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1000);

  const phoneInput = page
    .getByRole("textbox", { name: /número de teléfono|telefono/i })
    .or(page.getByLabel(/número de teléfono|telefono/i))
    .or(page.getByPlaceholder(/5512345678/))
    .or(page.locator('input[type="tel"]').first())
    .first();

  await phoneInput.waitFor({ state: "visible", timeout: 35_000 });
  await phoneInput.clear().catch(() => {});
  await phoneInput.fill(phone);

  const submit = page.getByRole("button", { name: /Buscar Vinculación/i });
  await submit.waitFor({ state: "visible", timeout: 15_000 });
  await submit.click();

  await delay(2800);

  const body = await page.locator("body").innerText();

  if (NO_PENDING.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Redphone: el portal indica que no hay proceso de vinculación pendiente para el número configurado.",
      isManualReview: false,
    };
  }

  if (SECURITY_FAILED.test(body)) {
    return {
      hasActiveLines: null,
      notes:
        "Redphone: «Verificación de seguridad fallida» (portal). No se infiere estado de líneas; reintente o revise manualmente.",
      isManualReview: true,
    };
  }

  if (/please fill out this field|completa este campo|required/i.test(body)) {
    return {
      hasActiveLines: null,
      notes:
        "Redphone: validación de campo; revise captura y el número de teléfono configurado en el servidor.",
      isManualReview: true,
    };
  }

  if (
    POSITIVE_SIGNAL.test(body) &&
    !NO_PENDING.test(body) &&
    !SECURITY_FAILED.test(body)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "Redphone: el portal muestra señales de proceso o líneas vinculadas; confirme en la captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Redphone: sin mensaje claro de «sin proceso pendiente» ni de éxito. Revise el portal o la captura.",
    isManualReview: true,
  };
}

export const redphoneBuscarVinculacionPattern: CompanyPattern = {
  id: "redphone-buscar-vinculacion",
  matches: () => false,
  matchesUrl: matchesRedphoneBuscarVinculacionUrl,
  supportsAutomatedVerification: true,
  run: runRedphoneBuscarVinculacion,
};
