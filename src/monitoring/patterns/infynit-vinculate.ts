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

/**
 * Infynit — vinculación por número de línea en `vinculate.infynit.mx`.
 * Paso 1: número a 10 dígitos + **Consultar** (no es CURP; el portal pide la línea móvil).
 */
export function matchesInfynitVinculateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "vinculate.infynit.mx";
  } catch {
    return false;
  }
}

const NO_LINE_OR_NOT_OPERATOR =
  /error al consultar la l[ií]nea|tu l[ií]nea est[aá] equivocada o no pertenece al operador/i;

export async function runInfynitVinculate(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "Infynit: el portal pide el número de línea a 10 dígitos en el paso 1 (no CURP). Falta configurar el número de teléfono de prueba en el servidor.",
      isManualReview: true,
    };
  }

  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(2500);

  const input = page
    .getByPlaceholder(/10 d[ií]gitos/i)
    .or(page.getByRole("textbox", { name: /n[uú]mero de l[ií]nea/i }))
    .first();

  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.clear().catch(() => {});
  await input.fill(phone);

  await page.getByRole("button", { name: /^Consultar$/i }).click();
  await delay(3500);

  const body = await page.locator("body").innerText();

  if (NO_LINE_OR_NOT_OPERATOR.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Infynit: el portal muestra «Error al consultar la línea» / línea equivocada o que no pertenece al operador (sin línea asociada o número incorrecto).",
      isManualReview: false,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Infynit: no apareció el mensaje de error de línea; si el portal avanzó de paso, confirme en captura (heurística conservadora).",
    isManualReview: true,
  };
}

export const infynitVinculatePattern: CompanyPattern = {
  id: "infynit-vinculate",
  matches: () => false,
  matchesUrl: matchesInfynitVinculateUrl,
  supportsAutomatedVerification: true,
  run: runInfynitVinculate,
};
