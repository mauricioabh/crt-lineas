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
 * EXiS — `https://www.exis.mx/#/vinculatulinea`
 *
 * El formulario carga en un iframe de `erebus.vadsa-mx.com/vinculatulinea`.
 * Todo el DOM relevante (botones, inputs, checkbox) está dentro de ese frame;
 * los locators de la página principal no lo alcanzan.
 *
 * El checkbox de «Acepto el tratamiento…» es un div visual puro (sin <input>):
 * hay que hacer el click vía frame.evaluate() para que registre el estado.
 */
export function matchesExisVinculatulineaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (h !== "exis.mx") return false;
    const loc = `${u.pathname}${u.hash}`;
    return /vinculatulinea/i.test(loc);
  } catch {
    return false;
  }
}

const NO_ACTIVE_LINE =
  /el n[uú]mero no existe o no est[aá] activo|numero no existe o no esta activo/i;

export async function runExisVinculatulinea(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  void context;
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "EXiS: falta el número de teléfono de prueba en el servidor (10 dígitos) para el paso «¿Cuál es tu número?».",
      isManualReview: true,
    };
  }

  await page.goto("https://www.exis.mx/#/vinculatulinea", {
    waitUntil: "load",
    timeout: 120_000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => {});
  await delay(3000);

  // El formulario vive en este iframe
  const fl = page.frameLocator('iframe[src*="erebus.vadsa-mx.com"]');
  const erebusFrame = page
    .frames()
    .find((f) => f.url().includes("erebus.vadsa-mx.com"));

  if (!erebusFrame) {
    return {
      hasActiveLines: null,
      notes:
        "EXiS: no se encontró el iframe de formulario (erebus.vadsa-mx.com). Puede que la URL del enlace haya cambiado o el portal esté caído.",
      isManualReview: true,
    };
  }

  // Paso 1: elegir «Ciudadano mexicano»
  await fl
    .locator("button")
    .filter({ hasText: /ciudadano mexicano/i })
    .first()
    .click();
  await delay(500);

  await fl.getByRole("button", { name: /^Continuar$/i }).click();
  await delay(2000);

  // Paso 2: número de celular
  await fl.locator('input[type="tel"]').pressSequentially(phone, { delay: 50 });
  await delay(400);

  // Checkbox visual (div puro sin <input>): debe activarse via evaluate
  await erebusFrame.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Acepto el tratamiento"),
    );
    label?.querySelector<HTMLElement>("div > div")?.click();
  });
  await delay(400);

  // Continuar debe estar habilitado ya; click con force por si acaso
  const continuar = fl.getByRole("button", { name: /^Continuar$/i });
  await continuar.click({ force: true });
  await delay(5000);

  const body = await fl
    .locator("body")
    .innerText()
    .catch(() => "");

  if (NO_ACTIVE_LINE.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "EXiS: el portal muestra «El número no existe o no está activo» (sin línea asociada o inactiva).",
      isManualReview: false,
    };
  }

  if (
    /\bpaso\s*[2-9]\s*de\s*8\b/i.test(body) ||
    /\bcurp\b/i.test(body) ||
    /\botp\b|c[oó]digo\s+(de\s+)?verificaci[oó]n|sms/i.test(body)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "EXiS: el flujo avanzó tras validar el número (paso siguiente / CURP / OTP). Confirme en captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "EXiS: no se detectó el mensaje de número inactivo ni un paso claro de éxito. Revise captura o cambios en el portal.",
    isManualReview: true,
  };
}

export const exisVinculatulineaPattern: CompanyPattern = {
  id: "exis-vinculatulinea",
  matches: () => false,
  matchesUrl: matchesExisVinculatulineaUrl,
  supportsAutomatedVerification: true,
  run: runExisVinculatulinea,
};
