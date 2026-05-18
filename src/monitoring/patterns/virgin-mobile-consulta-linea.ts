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
 * Virgin Mobile — Consulta de líneas registradas por CURP.
 * URL CRT: `https://virginmobile.mx/vinculatulinea/` (landing con QR) o directo a
 * `https://virginmobile.mx/v1/consultatulinea` (formulario de consulta).
 * Flujo: llenar CURP → «Consultar» → resultado.
 * Resultado negativo: «Sin líneas registradas» / «no tienes ninguna línea registrada».
 */
export function matchesVirginMobileConsultaLineaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "virginmobile.mx";
  } catch {
    return false;
  }
}

const NO_LINES =
  /sin\s+l[ií]neas\s+registradas|no\s+tienes\s+ninguna\s+l[ií]nea\s+registrada|actualmente\s+no\s+tienes\s+ninguna/i;

const HAS_LINES =
  /l[ií]nea(?:s)?\s+registrada(?:s)?|n[uú]mero(?:s)?\s+registrado(?:s)?|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/i;

export async function runVirginMobileConsultaLinea(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const curp = context.curp?.trim();
  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes:
        "Virgin Mobile: falta configurar el CURP de verificación en el servidor (18 caracteres) para la consulta de líneas registradas.",
      isManualReview: true,
    };
  }

  // Navegar directamente al formulario de consulta, evitando la landing con QR.
  await page.goto("https://virginmobile.mx/v1/consultatulinea", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1500);

  const curpInput = page
    .getByLabel(/^CURP$/i)
    .or(page.getByPlaceholder(/CURP/i))
    .or(page.locator('input[type="text"]').first())
    .first();

  await curpInput.waitFor({ state: "visible", timeout: 35_000 });
  await curpInput.clear().catch(() => {});
  await curpInput.fill(curp);

  const consultarBtn = page
    .getByRole("button", { name: /^Consultar$/i })
    .or(page.locator("button:has-text('Consultar')").first())
    .first();

  await consultarBtn.waitFor({ state: "visible", timeout: 15_000 });
  await consultarBtn.scrollIntoViewIfNeeded().catch(() => {});
  await consultarBtn.click();

  await delay(3000);

  const body = await page.locator("body").innerText();

  if (NO_LINES.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Virgin Mobile: el portal indica que no hay líneas registradas para la CURP.",
      isManualReview: false,
    };
  }

  if (HAS_LINES.test(body) && !NO_LINES.test(body)) {
    return {
      hasActiveLines: true,
      notes:
        "Virgin Mobile: el portal muestra líneas registradas para la CURP; confirme en la captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Virgin Mobile: resultado no claro tras «Consultar». Revise la captura o posibles cambios en el portal.",
    isManualReview: true,
  };
}

export const virginMobileConsultaLineaPattern: CompanyPattern = {
  id: "virgin-mobile-consulta-linea",
  matches: (companyName: string) => /virgin\s*mobile/i.test(companyName),
  matchesUrl: matchesVirginMobileConsultaLineaUrl,
  supportsAutomatedVerification: true,
  run: runVirginMobileConsultaLinea,
};
