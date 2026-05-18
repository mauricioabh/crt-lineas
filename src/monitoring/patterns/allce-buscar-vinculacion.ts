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

/** Asegura el formulario «Buscar Mi Vinculación» (`/buscar`) cuando el CRT guarda solo el origen. */
function normalizeAllceBuscarUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (h !== "vinculacion.allce.mx" && h !== "www.vinculacion.allce.mx") {
      return raw;
    }
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

/** Portal Allce — buscar proceso de vinculación por número (10 dígitos desde `MONITOR_PHONE`). */
export function matchesAllceBuscarVinculacionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return (
      (h === "vinculacion.allce.mx" || h === "www.vinculacion.allce.mx") &&
      !/\/consulta\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

const NO_PENDING = /no encontramos ningún proceso de vinculación pendiente/i;
const SECURITY_FAILED = /verificaci[oó]n de seguridad fallida/i;

/** Textos que indican flujo exitoso o proceso activo (no usar el título «Buscar Mi Vinculación» ni la palabra suelta «vinculación»). */
const POSITIVE_LINE_SIGNAL =
  /proceso de vinculaci[oó]n (?:encontrado|activo|disponible)|hay (?:un )?proceso pendiente|contin[uú]a (?:tu|con) (?:el )?proceso|l[ií]neas?\s+vinculadas|consulta tus l[ií]neas|vinculaci[oó]n completada|paso\s*2/i;

export async function runAllceBuscarVinculacion(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "Allce: falta tu celular en la configuración de verificación (10 dígitos sin +52).",
      isManualReview: true,
    };
  }

  const visitUrl = normalizeAllceBuscarUrl(context.url);
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
        "Allce: el portal indica que no hay proceso de vinculación pendiente para el número configurado.",
      isManualReview: false,
    };
  }

  if (SECURITY_FAILED.test(body)) {
    return {
      hasActiveLines: null,
      notes:
        "Allce: «Verificación de seguridad fallida» (portal). No se infiere estado de líneas; reintente o revise manualmente.",
      isManualReview: true,
    };
  }

  if (/please fill out this field|completa este campo|required/i.test(body)) {
    return {
      hasActiveLines: null,
      notes:
        "Allce: validación de campo; revise captura y el número de teléfono configurado en el servidor.",
      isManualReview: true,
    };
  }

  if (
    POSITIVE_LINE_SIGNAL.test(body) &&
    !NO_PENDING.test(body) &&
    !SECURITY_FAILED.test(body)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "Allce: el portal muestra señales de proceso o líneas vinculadas; confirme en la captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Allce: sin mensaje claro de «sin proceso pendiente» ni de éxito automático. Revise el portal o envíe texto de la pantalla de éxito para afinar el patrón.",
    isManualReview: true,
  };
}

export const allceBuscarVinculacionPattern: CompanyPattern = {
  id: "allce-buscar-vinculacion",
  matches: () => false,
  matchesUrl: matchesAllceBuscarVinculacionUrl,
  supportsAutomatedVerification: true,
  run: runAllceBuscarVinculacion,
};
