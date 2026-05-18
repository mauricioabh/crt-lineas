import type { Page } from "playwright";
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
 * Mega Móvil — consulta de líneas vinculadas por CURP.
 * URL de entrada (CRT): `https://registro.megamovil.mx/vinculatulinea/`
 * Portal de consulta:    `https://consultavinculacion.megamovil.mx/`
 */
export function matchesMegamovilConsultaVinculacionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (h === "consultavinculacion.megamovil.mx") return true;
    return h === "registro.megamovil.mx" && /vinculatulinea/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Mensaje que emite el portal cuando el CURP no tiene líneas asociadas. */
const NO_LINES =
  /la curp ingresada no cuenta con l[ií]neas\s*mega\s*m[oó]vil vinculadas/i;

/** Señales de que sí hay líneas (número enmascarado, tabla de resultados, etc.). */
const HAS_LINES_HINT =
  /l[ií]neas?\s+vinculadas|n[uú]mero\s+de\s+tel[eé]fono|tel[eé]fono\s+vinculado|\*{2,}/i;

export async function runMegamovilConsultaVinculacion(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const curp = context.curp?.trim();
  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes:
        "Mega Móvil: falta configurar el CURP de verificación en el servidor (18 caracteres) para la consulta de líneas vinculadas.",
      isManualReview: true,
    };
  }

  // Navegar directo al portal de consulta para evitar manejo de nueva pestaña.
  await page.goto("https://consultavinculacion.megamovil.mx/", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(2000);

  // Ingresar CURP.
  const curpInput = page
    .getByPlaceholder(/CURP\s*o\s*RFC/i)
    .or(page.getByRole("textbox", { name: /CURP/i }))
    .or(page.locator('input[type="text"]').first())
    .first();

  await curpInput.waitFor({ state: "visible", timeout: 35_000 });
  await curpInput.clear().catch(() => {});
  await curpInput.fill(curp);

  // Marcar el checkbox de aviso de privacidad si no está marcado.
  const privacyCheckbox = page
    .getByRole("checkbox")
    .or(page.locator('input[type="checkbox"]').first())
    .first();

  try {
    await privacyCheckbox.waitFor({ state: "visible", timeout: 8_000 });
    const isChecked = await privacyCheckbox.isChecked();
    if (!isChecked) {
      await privacyCheckbox.click();
    }
  } catch {
    // Si no es encontrado, intentar buscar por label texto.
    await page
      .getByText(/aviso de privacidad/i)
      .first()
      .click()
      .catch(() => {});
  }

  await delay(500);

  // Hacer click en «CONSULTAR».
  const consultarBtn = page
    .getByRole("button", { name: /^consultar$/i })
    .or(page.locator("button:has-text('CONSULTAR')"))
    .first();

  await consultarBtn.waitFor({ state: "visible", timeout: 15_000 });
  await consultarBtn.scrollIntoViewIfNeeded().catch(() => {});
  await consultarBtn.click();

  await delay(4000);

  const body = await page.locator("body").innerText();

  if (NO_LINES.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Mega Móvil: el portal indica que la CURP no cuenta con líneas Mega Móvil vinculadas.",
      isManualReview: false,
    };
  }

  if (HAS_LINES_HINT.test(body) && !NO_LINES.test(body)) {
    return {
      hasActiveLines: true,
      notes:
        "Mega Móvil: el portal muestra señales de líneas vinculadas al CURP; confirme en la captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Mega Móvil: resultado no claro tras «CONSULTAR». Revise la captura o posibles cambios en el portal.",
    isManualReview: true,
  };
}

export const megamovilConsultaVinculacionPattern: CompanyPattern = {
  id: "megamovil-consulta-vinculacion",
  matches: (companyName: string) => /mega\s*m[oó]vil/i.test(companyName),
  matchesUrl: matchesMegamovilConsultaVinculacionUrl,
  supportsAutomatedVerification: true,
  run: runMegamovilConsultaVinculacion,
};
