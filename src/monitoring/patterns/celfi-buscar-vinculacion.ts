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
function normalizeCelfiBuscarUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (h !== "vinculacion.celfi.com.mx") {
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

/** Portal Celfi — buscar proceso de vinculación por número (`MONITOR_PHONE`). */
export function matchesCelfiBuscarVinculacionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return (
      h === "vinculacion.celfi.com.mx" && !/\/consulta\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

const NO_PENDING = /no encontramos ningún proceso de vinculación pendiente/i;
const SECURITY_FAILED = /verificaci[oó]n de seguridad fallida/i;
const CAPTCHA_HINT = /recaptcha|hcaptcha|g-recaptcha/i;

const POSITIVE_LINE_SIGNAL =
  /proceso de vinculaci[oó]n (?:encontrado|activo|disponible)|hay (?:un )?proceso pendiente|contin[uú]a (?:tu|con) (?:el )?proceso|l[ií]neas?\s+vinculadas|consulta tus l[ií]neas|vinculaci[oó]n completada|paso\s*2/i;

function resolveCelfiOutcome(body: string): MonitorResult | null {
  if (NO_PENDING.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Celfi: el portal indica que no hay proceso de vinculación pendiente para el número configurado (sin líneas asociadas a ese flujo).",
      isManualReview: false,
    };
  }

  if (/please fill out this field|completa este campo|required/i.test(body)) {
    return {
      hasActiveLines: null,
      notes:
        "Celfi: validación de campo; revise captura y el número de teléfono configurado en el servidor.",
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
        "Celfi: el portal muestra señales de proceso o líneas vinculadas; confirme en la captura.",
      isManualReview: true,
    };
  }

  return null;
}

async function waitForOutcomeSignal(
  page: Page,
  maxWaitMs: number,
): Promise<string> {
  const started = Date.now();
  let lastBody = await page.locator("body").innerText();

  while (Date.now() - started < maxWaitMs) {
    if (
      NO_PENDING.test(lastBody) ||
      SECURITY_FAILED.test(lastBody) ||
      POSITIVE_LINE_SIGNAL.test(lastBody) ||
      /please fill out this field|completa este campo|required/i.test(lastBody)
    ) {
      return lastBody;
    }
    await delay(1000);
    lastBody = await page.locator("body").innerText();
  }

  return lastBody;
}

export async function runCelfiBuscarVinculacion(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "Celfi: falta el número de teléfono de prueba en el servidor (10 dígitos sin +52, ej. 5512345678) para rellenar «Número de Teléfono».",
      isManualReview: true,
    };
  }

  const visitUrl = normalizeCelfiBuscarUrl(context.url);
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
  await phoneInput.press("Tab").catch(() => {});

  const submit = page.getByRole("button", { name: /Buscar Vinculación/i });
  await submit.waitFor({ state: "visible", timeout: 15_000 });
  await submit.scrollIntoViewIfNeeded().catch(() => {});

  const assistedHeaded = process.env.PLAYWRIGHT_HEADED === "true";
  const assistedWaitMs = Math.max(
    5_000,
    Math.min(context.manualWaitMs, 180_000),
  );

  let body: string;
  if (assistedHeaded) {
    // Modo asistido real: no hacemos click automático; esperamos que el operador
    // pulse «Buscar Vinculación»/resuelva captcha y detectamos el resultado.
    body = await waitForOutcomeSignal(page, assistedWaitMs);
  } else {
    await submit.click();
    await delay(2800);
    body = await page.locator("body").innerText();
  }

  const directOutcome = resolveCelfiOutcome(body);
  if (directOutcome) {
    return directOutcome;
  }

  // Modo asistido: si el portal marca bloqueo de seguridad/captcha, damos una ventana
  // para intervención manual en navegador headed y re-evaluamos el resultado después.
  const hasCaptchaWidget =
    (await page
      .locator('iframe[src*="recaptcha"], .g-recaptcha, [class*="recaptcha"]')
      .count()) > 0;
  if (
    SECURITY_FAILED.test(body) ||
    CAPTCHA_HINT.test(body) ||
    hasCaptchaWidget
  ) {
    body = await waitForOutcomeSignal(page, assistedWaitMs);

    const assistedOutcome = resolveCelfiOutcome(body);
    if (assistedOutcome) {
      return assistedOutcome;
    }

    if (SECURITY_FAILED.test(body)) {
      return {
        hasActiveLines: null,
        notes:
          "Celfi (asistido): persistió «Verificación de seguridad fallida» tras la ventana de intervención manual. No se pudo confirmar estado de líneas.",
        isManualReview: true,
      };
    }
  }

  return {
    hasActiveLines: null,
    notes:
      "Celfi (asistido): no se detectó resultado claro durante la ventana de intervención. Verifique que se pulsó «Buscar Vinculación» y revise portal/captura.",
    isManualReview: true,
  };
}

export const celfiBuscarVinculacionPattern: CompanyPattern = {
  id: "celfi-buscar-vinculacion",
  matches: () => false,
  matchesUrl: matchesCelfiBuscarVinculacionUrl,
  supportsAutomatedVerification: true,
  run: runCelfiBuscarVinculacion,
};
